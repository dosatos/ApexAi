"""
Google Docs integration using Composio APIs.
Handles reading and writing Google Docs content to/from canvas items.
"""

from typing import Dict, Any, List, Optional
import os
import json
from dotenv import load_dotenv

load_dotenv()

def get_composio_client():
    """Initialize Composio client for direct API calls."""
    try:
        from composio import Composio
        user_id = os.getenv("COMPOSIO_USER_ID", "default")
        return Composio(), user_id
    except Exception as e:
        print(f"Failed to initialize Composio client: {e}")
        return None, None


def get_document_content(doc_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch Google Doc content using Composio's GOOGLEDOCS tools.

    Args:
        doc_id: Google Docs document ID

    Returns:
        Dictionary containing document data or None if failed
    """
    composio, user_id = get_composio_client()
    if not composio or not user_id:
        return None

    try:
        result = composio.tools.execute(
            user_id=user_id,
            slug="GOOGLEDOCS_GET_DOCUMENT_BY_ID",
            arguments={"id": doc_id}
        )

        if not result or not result.get("successful"):
            print(f"Failed to get document: {result}")
            return None

        doc_data = result.get("data", {}).get("response_data", {})
        print(f"Got document: {doc_data.get('title', 'Unknown')}")

        return {
            "title": doc_data.get("title", "Untitled Document"),
            "document_id": doc_data.get("documentId", doc_id),
            "body": doc_data.get("body", {}),
            "raw_data": doc_data
        }

    except Exception as e:
        print(f"Error fetching document: {e}")
        return None


def extract_text_from_document(doc_data: Dict[str, Any]) -> str:
    """
    Extract plain text content from Google Doc data structure.

    Args:
        doc_data: Document data returned from get_document_content()

    Returns:
        Plain text content of the document
    """
    if not doc_data or not doc_data.get("body"):
        return ""

    body = doc_data["body"]
    content = body.get("content", [])

    text_parts = []

    for element in content:
        if "paragraph" in element:
            paragraph = element["paragraph"]
            elements = paragraph.get("elements", [])

            paragraph_text = ""
            for elem in elements:
                if "textRun" in elem:
                    text_run = elem["textRun"]
                    paragraph_text += text_run.get("content", "")

            if paragraph_text.strip():
                text_parts.append(paragraph_text.strip())

        elif "table" in element:
            table = element["table"]
            table_rows = table.get("tableRows", [])

            for row in table_rows:
                cells = row.get("tableCells", [])
                row_text = []

                for cell in cells:
                    cell_content = cell.get("content", [])
                    cell_text = ""

                    for cell_elem in cell_content:
                        if "paragraph" in cell_elem:
                            para_elems = cell_elem["paragraph"].get("elements", [])
                            for para_elem in para_elems:
                                if "textRun" in para_elem:
                                    cell_text += para_elem["textRun"].get("content", "")

                    if cell_text.strip():
                        row_text.append(cell_text.strip())

                if row_text:
                    text_parts.append(" | ".join(row_text))

    return "\n\n".join(text_parts)


def convert_document_to_canvas_items(doc_data: Dict[str, Any], doc_id: str = "") -> Dict[str, Any]:
    """
    Convert Google Doc content to canvas format as a single document item.

    Args:
        doc_data: Data returned from get_document_content()
        doc_id: The document ID

    Returns:
        Dictionary with canvas state structure containing one document item
    """
    if not doc_data:
        return {
            "items": [],
            "globalTitle": "Empty Document",
            "globalDescription": "",
            "itemsCreated": 0,
        }

    title = doc_data.get("title", "Untitled Document")
    text_content = extract_text_from_document(doc_data)

    print(f"Converting Google Doc: '{title}' to canvas")
    print(f"Content length: {len(text_content)} characters")

    # Create a single document item with the full content
    item = {
        "id": "0001",
        "type": "document",
        "name": title,  # Use Google Doc title as card name
        "subtitle": "",  # Remove description as requested
        "data": {
            "content": text_content,  # Full document content
            "createdAt": doc_data.get("createdTime", ""),
            "modifiedAt": doc_data.get("modifiedTime", ""),
            "wordCount": len(text_content.split()) if text_content else 0,
            "googleDocsId": doc_id  # Store the Google Docs ID
        }
    }

    return {
        "items": [item],  # Only one item
        "globalTitle": f"Canvas: {title}",
        "globalDescription": "",  # No global description
        "itemsCreated": 1,
    }


def parse_document_sections(text: str) -> List[Dict[str, Any]]:
    """
    Parse document text into logical sections.

    Args:
        text: Plain text content

    Returns:
        List of section dictionaries
    """
    lines = text.split("\n")
    sections = []
    current_section = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        is_heading = (
            len(line) < 100 and
            (line.isupper() or
             line.endswith(":") or
             any(line.startswith(prefix) for prefix in ["#", "##", "###", "Chapter", "Section"]))
        )

        if is_heading:
            if current_section:
                sections.append(current_section)

            current_section = {
                "heading": line.rstrip(":").lstrip("#").strip(),
                "content": [],
                "subtitle": ""
            }
        else:
            if current_section is None:
                current_section = {
                    "heading": "Introduction",
                    "content": [],
                    "subtitle": ""
                }

            current_section["content"].append(line)

    if current_section:
        sections.append(current_section)

    if not sections and text.strip():
        sections.append({
            "heading": "Document Content",
            "content": [text.strip()],
            "subtitle": ""
        })

    return sections


def determine_section_type(section: Dict[str, Any]) -> str:
    """
    Determine the best canvas item type for a section.

    Args:
        section: Section dictionary with heading and content

    Returns:
        One of: 'project', 'entity', 'note', 'chart'
    """
    heading = section.get("heading", "").lower()
    content = " ".join(section.get("content", []))

    if any(keyword in heading for keyword in ["task", "todo", "action", "project", "milestone"]):
        return "project"

    if any(keyword in heading for keyword in ["metric", "data", "chart", "graph", "statistic"]):
        return "chart"

    if any(keyword in heading for keyword in ["person", "team", "contact", "entity", "profile"]):
        return "entity"

    if len(content) > 200:
        return "note"

    return "note"


def create_section_data(item_type: str, section: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create item data structure based on type and section content.

    Args:
        item_type: Type of canvas item
        section: Section dictionary

    Returns:
        Data structure appropriate for the item type
    """
    content = "\n".join(section.get("content", []))

    if item_type == "project":
        lines = section.get("content", [])
        checklist_items = []

        for idx, line in enumerate(lines):
            if line.startswith("- ") or line.startswith("* ") or line.startswith("• "):
                item_text = line[2:].strip()
                is_done = item_text.startswith("[x]") or item_text.startswith("[X]")
                if is_done:
                    item_text = item_text[3:].strip()

                checklist_items.append({
                    "id": str(idx + 1).zfill(3),
                    "text": item_text,
                    "done": is_done,
                    "proposed": False
                })

        return {
            "field1": content[:500] if not checklist_items else "",
            "field2": "",
            "field3": "",
            "field4": checklist_items,
            "field4_id": len(checklist_items),
        }

    elif item_type == "entity":
        return {
            "field1": content[:500],
            "field2": "",
            "field3": [],
            "field3_options": ["Document", "Section", "Import", "Tag 1", "Tag 2"],
        }

    elif item_type == "note":
        return {
            "field1": content,
        }

    elif item_type == "chart":
        return {
            "field1": [],
            "field1_id": 0,
        }

    return {"field1": content}


def create_new_document(title: str = "Canvas Export", markdown_content: str = "") -> Dict[str, Any]:
    """
    Create a new Google Doc with markdown content.

    Args:
        title: Title for the new document
        markdown_content: Initial markdown content for the document

    Returns:
        Dictionary with new document info
    """
    title = ensure_gdoc_extension(title)

    composio, user_id = get_composio_client()
    if not composio or not user_id:
        return {"success": False, "error": "Failed to initialize Composio client"}

    try:
        result = composio.tools.execute(
            user_id=user_id,
            slug="GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN",
            arguments={
                "title": title,
                "markdown_text": markdown_content
            }
        )

        print(f"Composio API result for document creation: {result}")

        if result and result.get("successful"):
            doc_data = result.get("data", {}).get("response_data", {})
            doc_id = doc_data.get("documentId", "")
            doc_url = f"https://docs.google.com/document/d/{doc_id}/edit" if doc_id else ""

            print(f"Successfully created document: {doc_id}, url: {doc_url}")

            return {
                "success": True,
                "doc_id": doc_id,
                "doc_url": doc_url,
                "title": title
            }
        else:
            error_msg = result.get("error", "Unknown error") if result else "No response"
            print(f"Document creation failed: {result}")
            return {
                "success": False,
                "error": f"Failed to create document: {error_msg}"
            }

    except Exception as e:
        return {
            "success": False,
            "error": f"Exception during document creation: {str(e)}"
        }


def ensure_gdoc_extension(title: str) -> str:
    """
    Ensure the title has a .gdoc extension for Google Docs.

    Args:
        title: Original title

    Returns:
        Title with .gdoc extension if not already present
    """
    if not title.endswith('.gdoc'):
        return f"{title}.gdoc"
    return title


def create_document_with_item_content(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new Google Doc with content from a single canvas item.

    Args:
        item: Canvas item with type, name, and data

    Returns:
        Dictionary with new document info
    """
    title = item.get("name", "Untitled Document")
    title = ensure_gdoc_extension(title)
    item_data = item.get("data", {})

    print(f"Creating document for item: {title}")
    print(f"Item data: {item_data}")

    # Build markdown content for the item
    content_parts = []

    # Get the main content based on item type
    if item.get("type") == "document":
        content = item_data.get("content", "")
        print(f"Document content found: '{content}'")
        if content:
            content_parts.append(f"{content}\n\n")
        else:
            content_parts.append("*No content yet*\n\n")

    markdown_content = "".join(content_parts)
    print(f"Final markdown content: {markdown_content}")

    # Create the document with markdown content
    return create_new_document(title, markdown_content)


def update_document_with_item_content(doc_id: str, item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update a Google Doc with content from a single canvas item.

    Args:
        doc_id: Google Docs document ID
        item: Canvas item with type, name, and data

    Returns:
        Dictionary with update result status
    """
    composio, user_id = get_composio_client()
    if not composio or not user_id:
        return {"success": False, "error": "Failed to initialize Composio client"}

    try:
        title = item.get("name", "Untitled Document")
        item_data = item.get("data", {})

        print(f"Updating document {doc_id} for item: {title}")
        print(f"Item data: {item_data}")

        # Build markdown content for the item
        content_parts = []

        # Get the main content based on item type
        if item.get("type") == "document":
            content = item_data.get("content", "")
            print(f"Document content found: '{content}'")
            if content:
                content_parts.append(f"{content}\n\n")
            else:
                content_parts.append("*No content yet*\n\n")

        full_content = "".join(content_parts)
        print(f"Final markdown content: {full_content}")

        # Use UPDATE_DOCUMENT_MARKDOWN to replace entire content
        result = composio.tools.execute(
            user_id=user_id,
            slug="GOOGLEDOCS_UPDATE_DOCUMENT_MARKDOWN",
            arguments={
                "document_id": doc_id,
                "new_markdown_text": full_content
            }
        )

        print(f"Update result: {result}")

        if result and result.get("successful"):
            return {
                "success": True,
                "message": f"Updated document with item content: {title}",
                "doc_id": doc_id
            }
        else:
            error_msg = result.get("error", "Unknown error") if result else "No response"
            return {
                "success": False,
                "error": f"Failed to update Google Doc: {error_msg}"
            }

    except Exception as e:
        return {
            "success": False,
            "error": f"Exception during document update: {str(e)}"
        }


def write_canvas_to_document(doc_id: str, canvas_state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Write canvas state to a Google Doc.

    Args:
        doc_id: Google Docs document ID
        canvas_state: Canvas state with items, globalTitle, etc.

    Returns:
        Dictionary with sync result status
    """
    composio, user_id = get_composio_client()
    if not composio or not user_id:
        return {"success": False, "error": "Failed to initialize Composio client"}

    try:
        items = canvas_state.get("items", [])
        global_title = canvas_state.get("globalTitle", "Canvas Export")

        content_parts = []
        content_parts.append(f"# {global_title}\n\n")

        if canvas_state.get("globalDescription"):
            content_parts.append(f"{canvas_state['globalDescription']}\n\n")

        for item in items:
            item_type = item.get("type", "note")
            item_name = item.get("name", "Untitled")
            item_subtitle = item.get("subtitle", "")
            item_data = item.get("data", {})

            content_parts.append(f"## {item_name}\n\n")

            if item_subtitle:
                content_parts.append(f"*{item_subtitle}*\n\n")

            if item_type == "project":
                if item_data.get("field1"):
                    content_parts.append(f"{item_data['field1']}\n\n")

                checklist = item_data.get("field4", [])
                if checklist:
                    content_parts.append("**Tasks:**\n\n")
                    for task in checklist:
                        status = "[x]" if task.get("done") else "[ ]"
                        content_parts.append(f"- {status} {task.get('text', '')}\n")
                    content_parts.append("\n")

            elif item_type == "entity":
                if item_data.get("field1"):
                    content_parts.append(f"{item_data['field1']}\n\n")

                tags = item_data.get("field3", [])
                if tags:
                    content_parts.append(f"Tags: {', '.join(tags)}\n\n")

            elif item_type == "note":
                content_parts.append(f"{item_data.get('field1', '')}\n\n")

            elif item_type == "chart":
                metrics = item_data.get("field1", [])
                if metrics:
                    content_parts.append("**Metrics:**\n\n")
                    for metric in metrics:
                        label = metric.get("label", "")
                        value = metric.get("value", "")
                        content_parts.append(f"- {label}: {value}\n")
                    content_parts.append("\n")

        full_content = "".join(content_parts)

        # Use UPDATE_DOCUMENT_MARKDOWN to replace entire content
        result = composio.tools.execute(
            user_id=user_id,
            slug="GOOGLEDOCS_UPDATE_DOCUMENT_MARKDOWN",
            arguments={
                "document_id": doc_id,
                "new_markdown_text": full_content
            }
        )

        print(f"Write result: {result}")

        if result and result.get("successful"):
            return {
                "success": True,
                "message": f"Exported {len(items)} items to Google Docs",
                "doc_id": doc_id,
                "items_exported": len(items)
            }
        else:
            error_msg = result.get("error", "Unknown error") if result else "No response"
            return {
                "success": False,
                "error": f"Failed to write to Google Docs: {error_msg}"
            }

    except Exception as e:
        return {
            "success": False,
            "error": f"Exception during document write: {str(e)}"
        }


if __name__ == "__main__":
    test_doc_id = input("Enter Google Docs ID to test: ")
    if test_doc_id:
        print("Fetching document content...")
        doc_data = get_document_content(test_doc_id)
        if doc_data:
            print(f"Title: {doc_data.get('title')}")
            text = extract_text_from_document(doc_data)
            print(f"Extracted {len(text)} characters")
            print(f"Preview: {text[:500]}...")

            canvas_data = convert_document_to_canvas_items(doc_data, test_doc_id)
            print(f"\nConverted to {len(canvas_data['items'])} canvas items")
            print(json.dumps(canvas_data, indent=2))
        else:
            print("Failed to fetch document")