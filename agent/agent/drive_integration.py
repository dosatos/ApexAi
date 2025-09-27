"""
Google Drive integration using Composio APIs.
Handles browsing, downloading, and managing Google Drive files.
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


def list_drive_files(folder_id: Optional[str] = None, page_size: int = 20) -> Optional[Dict[str, Any]]:
    """
    List files in Google Drive.

    Args:
        folder_id: Optional folder ID to list files from (None for root)
        page_size: Number of files to return (max 100)

    Returns:
        Dictionary containing file list or None if failed
    """
    composio, user_id = get_composio_client()
    if not composio or not user_id:
        print("Failed to get Composio client")
        return None

    try:
        # Try a simple list first to test authentication
        print(f"Attempting to list Drive files for user: {user_id}")

        # Build query parameters - start with a simple query
        query_params = {
            "pageSize": min(page_size, 100),
            "fields": "files(id,name,mimeType,size,modifiedTime,webViewLink,parents,thumbnailLink)",
            "q": "trashed=false",
            "orderBy": "modifiedTime desc"
        }

        print(f"Query parameters: {query_params}")

        result = composio.tools.execute(
            user_id=user_id,
            slug="GOOGLEDRIVE_LIST_FILES",
            arguments=query_params
        )

        print(f"Raw Composio result: {result}")

        if not result or not result.get("successful"):
            print(f"Drive API call failed: {result}")
            error_msg = result.get("error", "Unknown error") if result else "No response"
            print(f"Error details: {error_msg}")
            return None

        files_data = result.get("data", {})
        files = files_data.get("files", [])

        print(f"Found {len(files)} files in Drive")
        if files:
            print(f"Sample files: {[f.get('name', 'unnamed') for f in files[:3]]}")

        return {
            "files": files,
            "folder_id": folder_id,
            "total_count": len(files)
        }

    except Exception as e:
        print(f"Exception listing drive files: {e}")
        import traceback
        traceback.print_exc()
        return None


def get_file_content(file_id: str) -> Optional[Dict[str, Any]]:
    """
    Get file content from Google Drive.

    Args:
        file_id: Google Drive file ID

    Returns:
        Dictionary containing file content or None if failed
    """
    composio, user_id = get_composio_client()
    if not composio or not user_id:
        return None

    try:
        # First get file metadata
        metadata_result = composio.tools.execute(
            user_id=user_id,
            slug="GOOGLEDRIVE_GET_FILE_METADATA",
            arguments={"fileId": file_id}
        )

        if not metadata_result or not metadata_result.get("successful"):
            print(f"Failed to get file metadata: {metadata_result}")
            return None

        file_metadata = metadata_result.get("data", {}).get("response_data", {})
        mime_type = file_metadata.get("mimeType", "")
        file_name = file_metadata.get("name", "Unknown File")

        print(f"Getting content for file: {file_name} (type: {mime_type})")

        # Handle different file types
        if mime_type.startswith("text/") or mime_type in [
            "application/json",
            "application/javascript",
            "application/xml"
        ]:
            # Download as text for text files
            content_result = composio.tools.execute(
                user_id=user_id,
                slug="GOOGLEDRIVE_DOWNLOAD_FILE",
                arguments={"fileId": file_id}
            )

            if content_result and content_result.get("successful"):
                content_data = content_result.get("data", {}).get("response_data", {})
                content = content_data.get("content", "")

                return {
                    "file_id": file_id,
                    "name": file_name,
                    "mime_type": mime_type,
                    "content": content,
                    "content_type": "text",
                    "metadata": file_metadata
                }

        elif mime_type == "application/vnd.google-apps.document":
            # Export Google Docs as plain text
            export_result = composio.tools.execute(
                user_id=user_id,
                slug="GOOGLEDRIVE_EXPORT_FILE",
                arguments={
                    "fileId": file_id,
                    "mimeType": "text/plain"
                }
            )

            if export_result and export_result.get("successful"):
                content_data = export_result.get("data", {}).get("response_data", {})
                content = content_data.get("content", "")

                return {
                    "file_id": file_id,
                    "name": file_name,
                    "mime_type": mime_type,
                    "content": content,
                    "content_type": "google_doc",
                    "metadata": file_metadata
                }

        elif mime_type == "application/vnd.google-apps.spreadsheet":
            # Export Google Sheets as CSV
            export_result = composio.tools.execute(
                user_id=user_id,
                slug="GOOGLEDRIVE_EXPORT_FILE",
                arguments={
                    "fileId": file_id,
                    "mimeType": "text/csv"
                }
            )

            if export_result and export_result.get("successful"):
                content_data = export_result.get("data", {}).get("response_data", {})
                content = content_data.get("content", "")

                return {
                    "file_id": file_id,
                    "name": file_name,
                    "mime_type": mime_type,
                    "content": content,
                    "content_type": "google_sheet",
                    "metadata": file_metadata
                }

        else:
            # For other file types, just return metadata
            return {
                "file_id": file_id,
                "name": file_name,
                "mime_type": mime_type,
                "content": f"File type {mime_type} not supported for content extraction",
                "content_type": "unsupported",
                "metadata": file_metadata
            }

    except Exception as e:
        print(f"Error getting file content: {e}")
        return None


def search_drive_files(query: str, page_size: int = 20) -> Optional[Dict[str, Any]]:
    """
    Search for files in Google Drive.

    Args:
        query: Search query string
        page_size: Number of files to return (max 100)

    Returns:
        Dictionary containing search results or None if failed
    """
    composio, user_id = get_composio_client()
    if not composio or not user_id:
        return None

    try:
        search_params = {
            "q": f"name contains '{query}' and trashed=false",
            "pageSize": min(page_size, 100),
            "fields": "files(id,name,mimeType,size,modifiedTime,webViewLink,parents,thumbnailLink)",
            "orderBy": "modifiedTime desc"
        }

        result = composio.tools.execute(
            user_id=user_id,
            slug="GOOGLEDRIVE_LIST_FILES",
            arguments=search_params
        )

        if not result or not result.get("successful"):
            print(f"Failed to search files: {result}")
            return None

        files_data = result.get("data", {})
        files = files_data.get("files", [])

        print(f"Found {len(files)} files matching '{query}'")

        return {
            "files": files,
            "query": query,
            "total_count": len(files)
        }

    except Exception as e:
        print(f"Error searching drive files: {e}")
        return None


def convert_drive_file_to_canvas_item(file_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a Google Drive file to a canvas document item.

    Args:
        file_data: Data returned from get_file_content()

    Returns:
        Dictionary with canvas item structure
    """
    if not file_data:
        return {}

    file_name = file_data.get("name", "Unknown File")
    content = file_data.get("content", "")
    content_type = file_data.get("content_type", "text")
    file_id = file_data.get("file_id", "")
    mime_type = file_data.get("mime_type", "")

    # Determine subtitle based on file type
    subtitle = ""
    if content_type == "google_doc":
        subtitle = "Google Docs"
    elif content_type == "google_sheet":
        subtitle = "Google Sheets"
    elif mime_type.startswith("text/"):
        subtitle = f"Text File ({mime_type.split('/')[-1].upper()})"
    else:
        subtitle = f"Drive File ({mime_type.split('/')[-1].upper()})"

    # Create document item
    item = {
        "id": "0001",
        "type": "document",
        "name": file_name,
        "subtitle": subtitle,
        "data": {
            "content": content,
            "createdAt": file_data.get("metadata", {}).get("createdTime", ""),
            "modifiedAt": file_data.get("metadata", {}).get("modifiedTime", ""),
            "wordCount": len(content.split()) if content else 0,
            "googleDriveId": file_id,
            "googleDriveMimeType": mime_type,
            "googleDriveLink": file_data.get("metadata", {}).get("webViewLink", "")
        }
    }

    return item


def get_folder_info(folder_id: str) -> Optional[Dict[str, Any]]:
    """
    Get information about a specific folder.

    Args:
        folder_id: Google Drive folder ID

    Returns:
        Dictionary containing folder information or None if failed
    """
    composio, user_id = get_composio_client()
    if not composio or not user_id:
        return None

    try:
        result = composio.tools.execute(
            user_id=user_id,
            slug="GOOGLEDRIVE_GET_FILE_METADATA",
            arguments={"fileId": folder_id}
        )

        if not result or not result.get("successful"):
            print(f"Failed to get folder info: {result}")
            return None

        folder_data = result.get("data", {}).get("response_data", {})

        return {
            "id": folder_data.get("id", folder_id),
            "name": folder_data.get("name", "Unknown Folder"),
            "mime_type": folder_data.get("mimeType", ""),
            "modified_time": folder_data.get("modifiedTime", ""),
            "web_view_link": folder_data.get("webViewLink", "")
        }

    except Exception as e:
        print(f"Error getting folder info: {e}")
        return None


if __name__ == "__main__":
    # Test the integration
    print("Testing Google Drive integration...")

    # List recent files
    print("\nListing recent files...")
    files = list_drive_files(page_size=5)
    if files:
        print(f"Found {len(files.get('files', []))} files")
        for file in files.get('files', [])[:3]:
            print(f"- {file.get('name')} ({file.get('mimeType')})")

    # Test search
    search_query = input("\nEnter search query (or press Enter to skip): ").strip()
    if search_query:
        search_results = search_drive_files(search_query, page_size=5)
        if search_results:
            print(f"Found {len(search_results.get('files', []))} files matching '{search_query}'")
            for file in search_results.get('files', [])[:3]:
                print(f"- {file.get('name')} ({file.get('mimeType')})")