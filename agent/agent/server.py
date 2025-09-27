from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pathlib import Path
from typing import Optional
import os

# Load environment variables from .env/.env.local (repo root or agent dir) if present
try:
    from dotenv import load_dotenv  # type: ignore
except Exception:
    load_dotenv = None  # python-dotenv may not be installed yet

def _load_env_files() -> None:
    if load_dotenv is None:
        return
    here = Path(__file__).resolve()
    candidates = [
        here.parents[2] / ".env.local",  # repo root/.env.local
        here.parents[2] / ".env",        # repo root/.env
        here.parents[1] / ".env.local",  # agent/.env.local
        here.parents[1] / ".env",        # agent/.env
    ]
    for p in candidates:
        if p.exists():
            load_dotenv(p, override=False)

_load_env_files()

from .agent import agentic_chat_router
from .sheets_integration import get_sheet_data, convert_sheet_to_canvas_items, sync_canvas_to_sheet, get_sheet_names, create_new_sheet
from .docs_integration import get_document_content, convert_document_to_canvas_items, create_new_document, write_canvas_to_document, create_document_with_item_content, update_document_with_item_content
from .drive_integration import list_drive_files, get_file_content, search_drive_files, convert_drive_file_to_canvas_item, get_folder_info

app = FastAPI()
app.include_router(agentic_chat_router)

# Request models
class SheetSyncRequest(BaseModel):
    sheet_id: str
    sheet_name: Optional[str] = None

class CanvasToSheetSyncRequest(BaseModel):
    canvas_state: dict
    sheet_id: str
    sheet_name: Optional[str] = None

class CreateSheetRequest(BaseModel):
    title: str

class DocImportRequest(BaseModel):
    doc_id: str

class DocExportRequest(BaseModel):
    canvas_state: dict
    doc_id: str

class CreateDocRequest(BaseModel):
    title: str

class CreateDocWithItemRequest(BaseModel):
    item: dict

class UpdateDocWithItemRequest(BaseModel):
    doc_id: str
    item: dict

class DriveListRequest(BaseModel):
    folder_id: Optional[str] = None
    page_size: Optional[int] = 20

class DriveSearchRequest(BaseModel):
    query: str
    page_size: Optional[int] = 20

class DriveFileRequest(BaseModel):
    file_id: str

# Sheets sync endpoint
@app.post("/sheets/sync")
async def sync_sheets(request: SheetSyncRequest):
    """
    Sync data from Google Sheets to canvas format.
    
    Args:
        request: Contains sheet_id to import from
        
    Returns:
        Canvas state with items converted from sheet data
    """
    try:
        # Extract sheet ID from URL if full URL is provided
        sheet_id = request.sheet_id
        if "/spreadsheets/d/" in sheet_id:
            # Extract ID from Google Sheets URL
            start = sheet_id.find("/spreadsheets/d/") + len("/spreadsheets/d/")
            end = sheet_id.find("/", start)
            if end == -1:
                end = sheet_id.find("#", start)
            if end == -1:
                end = len(sheet_id)
            sheet_id = sheet_id[start:end]
        
        sheet_name = request.sheet_name
        if sheet_name:
            print(f"Syncing sheet: {sheet_id} (sheet: {sheet_name})")
        else:
            print(f"Syncing sheet: {sheet_id} (default sheet)")
        
        # Fetch sheet data using Composio
        sheet_data = get_sheet_data(sheet_id, sheet_name)
        if not sheet_data:
            raise HTTPException(
                status_code=400, 
                detail="Failed to fetch sheet data. Please check the sheet ID and ensure it's accessible."
            )
        
        # Convert to canvas items
        canvas_data = convert_sheet_to_canvas_items(sheet_data, sheet_id)
        
        return JSONResponse(content={
            "success": True,
            "data": canvas_data,
            "message": f"Successfully imported {len(canvas_data['items'])} items from sheet '{canvas_data['globalTitle']}'"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in sheets sync: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/sync-to-sheets")
async def sync_canvas_to_sheets(request: CanvasToSheetSyncRequest):
    """
    Sync canvas state to Google Sheets.
    
    Args:
        request: Contains canvas_state and sheet_id
        
    Returns:
        Sync result status
    """
    try:
        sheet_name_info = f" (sheet: {request.sheet_name})" if request.sheet_name else ""
        print(f"[SYNC] Syncing canvas to sheet: {request.sheet_id}{sheet_name_info}")
        
        # Call the sync function with sheet name
        result = sync_canvas_to_sheet(request.sheet_id, request.canvas_state, request.sheet_name)
        
        if result.get("success"):
            return JSONResponse(content={
                "success": True,
                "message": result.get("message"),
                "items_synced": result.get("items_synced", 0)
            })
        else:
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to sync canvas to sheets")
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in canvas-to-sheets sync: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/sheets/list")
async def list_sheet_names(request: SheetSyncRequest):
    """
    List available sheet names in a Google Spreadsheet.
    
    Args:
        request: Contains sheet_id
        
    Returns:
        List of available sheet names
    """
    try:
        print(f"Listing sheets in: {request.sheet_id}")
        
        # Get sheet names using Composio
        sheet_names = get_sheet_names(request.sheet_id)
        if not sheet_names:
            raise HTTPException(
                status_code=400, 
                detail="Failed to get sheet names. Please check the sheet ID and ensure it's accessible."
            )
        
        return JSONResponse(content={
            "success": True,
            "sheet_names": sheet_names,
            "count": len(sheet_names)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in sheet listing: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/sheets/create")
async def create_sheet(request: CreateSheetRequest):
    """
    Create a new Google Sheet.
    
    Args:
        request: Contains title for the new sheet
        
    Returns:
        New sheet details including sheet_id and URL
    """
    try:
        print(f"Creating new sheet with title: {request.title}")
        
        # Create new sheet using Composio
        result = create_new_sheet(request.title)
        if not result.get("success"):
            raise HTTPException(
                status_code=400, 
                detail=result.get("error", "Failed to create new sheet")
            )
        
        return JSONResponse(content={
            "success": True,
            "sheet_id": result.get("sheet_id"),
            "sheet_url": result.get("sheet_url"),
            "title": result.get("title"),
            "message": f"Successfully created new sheet '{request.title}'"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating sheet: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

# Google Docs endpoints
@app.post("/docs/import")
async def import_from_doc(request: DocImportRequest):
    """
    Import data from Google Docs to canvas format.

    Args:
        request: Contains doc_id to import from

    Returns:
        Canvas state with items converted from doc data
    """
    try:
        # Extract doc ID from URL if full URL is provided
        doc_id = request.doc_id
        if "/document/d/" in doc_id:
            # Extract ID from Google Docs URL
            start = doc_id.find("/document/d/") + len("/document/d/")
            end = doc_id.find("/", start)
            if end == -1:
                end = doc_id.find("#", start)
            if end == -1:
                end = len(doc_id)
            doc_id = doc_id[start:end]

        print(f"Importing doc: {doc_id}")

        # Fetch document data using Composio
        doc_data = get_document_content(doc_id)
        if not doc_data:
            raise HTTPException(
                status_code=400,
                detail="Failed to fetch document data. Please check the doc ID and ensure it's accessible."
            )

        # Convert to canvas items
        canvas_data = convert_document_to_canvas_items(doc_data, doc_id)

        return JSONResponse(content={
            "success": True,
            "data": canvas_data,
            "message": f"Successfully imported {len(canvas_data['items'])} items from document '{canvas_data['globalTitle']}'"
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in docs import: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/docs/create")
async def create_doc(request: CreateDocRequest):
    """
    Create a new Google Doc.

    Args:
        request: Contains title for the new doc

    Returns:
        New doc details including doc_id and URL
    """
    try:
        print(f"Creating new doc with title: {request.title}")

        # Create new doc using Composio
        result = create_new_document(request.title)
        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to create new document")
            )

        return JSONResponse(content={
            "success": True,
            "doc_id": result.get("doc_id"),
            "doc_url": result.get("doc_url"),
            "title": result.get("title"),
            "message": f"Successfully created new document '{request.title}'"
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating document: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/docs/export")
async def export_to_doc(request: DocExportRequest):
    """
    Export canvas state to Google Docs.

    Args:
        request: Contains canvas_state and doc_id

    Returns:
        Export result status
    """
    try:
        print(f"[EXPORT] Exporting canvas to doc: {request.doc_id}")

        # Call the export function
        result = write_canvas_to_document(request.doc_id, request.canvas_state)

        if result.get("success"):
            return JSONResponse(content={
                "success": True,
                "message": result.get("message"),
                "items_exported": result.get("items_exported", 0)
            })
        else:
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to export canvas to document")
            )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in canvas-to-docs export: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/docs/create-with-item")
async def create_doc_with_item(request: CreateDocWithItemRequest):
    """
    Create a new Google Doc with content from a canvas item.

    Args:
        request: Contains item data with type, name, subtitle, and content

    Returns:
        New doc details including doc_id and URL
    """
    try:
        item_name = request.item.get("name", "Untitled Document")
        print(f"Creating new doc with item content: {item_name}")

        # Create new doc with item content using Composio
        result = create_document_with_item_content(request.item)
        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to create new document with item content")
            )

        return JSONResponse(content={
            "success": True,
            "doc_id": result.get("doc_id"),
            "doc_url": result.get("doc_url"),
            "title": result.get("title"),
            "message": f"Successfully created new document '{item_name}' with content"
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating document with item: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/docs/update-with-item")
async def update_doc_with_item(request: UpdateDocWithItemRequest):
    """
    Update an existing Google Doc with content from a canvas item.

    Args:
        request: Contains doc_id and item data with type, name, subtitle, and content

    Returns:
        Update result status
    """
    try:
        item_name = request.item.get("name", "Untitled Document")
        print(f"Updating doc {request.doc_id} with item content: {item_name}")

        # Update doc with item content using Composio
        result = update_document_with_item_content(request.doc_id, request.item)
        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to update document with item content")
            )

        return JSONResponse(content={
            "success": True,
            "doc_id": result.get("doc_id"),
            "message": result.get("message", f"Successfully updated document '{item_name}' with content")
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating document with item: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

# Google Drive endpoints
@app.post("/drive/list")
async def list_files(request: DriveListRequest):
    """
    List files in Google Drive.

    Args:
        request: Contains optional folder_id and page_size

    Returns:
        List of files with metadata
    """
    try:
        print(f"Listing Drive files (folder: {request.folder_id}, limit: {request.page_size})")

        # List files using Composio
        files_data = list_drive_files(request.folder_id, request.page_size or 20)
        if not files_data:
            raise HTTPException(
                status_code=400,
                detail="Failed to list Drive files. Please check your authentication and permissions."
            )

        return JSONResponse(content={
            "success": True,
            "files": files_data.get("files", []),
            "folder_id": files_data.get("folder_id"),
            "total_count": files_data.get("total_count", 0),
            "message": f"Found {len(files_data.get('files', []))} files"
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error listing Drive files: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/drive/search")
async def search_files(request: DriveSearchRequest):
    """
    Search for files in Google Drive.

    Args:
        request: Contains search query and page_size

    Returns:
        List of matching files with metadata
    """
    try:
        print(f"Searching Drive files for: '{request.query}'")

        # Search files using Composio
        search_results = search_drive_files(request.query, request.page_size or 20)
        if not search_results:
            raise HTTPException(
                status_code=400,
                detail="Failed to search Drive files. Please check your authentication and permissions."
            )

        return JSONResponse(content={
            "success": True,
            "files": search_results.get("files", []),
            "query": search_results.get("query"),
            "total_count": search_results.get("total_count", 0),
            "message": f"Found {len(search_results.get('files', []))} files matching '{request.query}'"
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error searching Drive files: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/drive/import")
async def import_from_drive(request: DriveFileRequest):
    """
    Import a file from Google Drive to canvas format.

    Args:
        request: Contains file_id to import

    Returns:
        Canvas item created from the Drive file
    """
    try:
        print(f"Importing Drive file: {request.file_id}")

        # Get file content using Composio
        file_data = get_file_content(request.file_id)
        if not file_data:
            raise HTTPException(
                status_code=400,
                detail="Failed to get file content. Please check the file ID and ensure it's accessible."
            )

        # Convert to canvas item
        canvas_item = convert_drive_file_to_canvas_item(file_data)
        if not canvas_item:
            raise HTTPException(
                status_code=400,
                detail="Failed to convert file to canvas format."
            )

        # Create a simple canvas state with the single item
        canvas_data = {
            "items": [canvas_item],
            "globalTitle": f"Import: {canvas_item.get('name', 'Unknown File')}",
            "globalDescription": f"Imported from Google Drive",
            "itemsCreated": 1,
        }

        return JSONResponse(content={
            "success": True,
            "data": canvas_data,
            "message": f"Successfully imported '{canvas_item.get('name', 'Unknown File')}' from Google Drive"
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error importing from Drive: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
