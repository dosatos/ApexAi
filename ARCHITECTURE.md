# Architecture

## Project Overview

This is a fullstack AI-powered canvas application built with **Next.js** (frontend), **Python FastAPI** (backend), **LlamaIndex** (agent framework), **CopilotKit** (AI UI integration), and **Composio** (external tool integrations). The application provides a visual canvas interface for managing interactive cards (projects, entities, notes, charts) with real-time AI synchronization and Google Sheets & Google Docs integration.

## Technology Stack

### Frontend
- **Next.js 15.3** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **CopilotKit** - AI copilot integration
- **Radix UI** - Accessible component primitives
- **Motion (Framer Motion)** - Animations

### Backend
- **Python 3.9-3.13** - Runtime
- **FastAPI** - Web framework
- **LlamaIndex** - Agent and workflow framework
- **OpenAI GPT-4.1** - LLM
- **Composio** - External tool integrations (Google Sheets, Google Docs)
- **Python-dotenv** - Environment configuration
- **Uvicorn** - ASGI server

## Project Structure

```
.
├── src/                          # Frontend source code
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API routes
│   │   │   ├── copilotkit/       # CopilotKit runtime endpoint
│   │   │   ├── sheets/           # Google Sheets API endpoints
│   │   │   │   ├── create/       # Create new sheet
│   │   │   │   ├── import/       # Import from sheet
│   │   │   │   ├── list/         # List sheet names
│   │   │   │   └── sync/         # Sync canvas to sheet
│   │   │   └── docs/             # Google Docs API endpoints
│   │   │       ├── create/       # Create new document
│   │   │       ├── import/       # Import from document
│   │   │       └── export/       # Export canvas to document
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Main canvas page
│   │   └── globals.css           # Global styles
│   ├── components/               # React components
│   │   ├── canvas/               # Canvas-specific components
│   │   │   ├── AppChatHeader.tsx    # Chat header component
│   │   │   ├── CardRenderer.tsx     # Card rendering logic
│   │   │   ├── ItemHeader.tsx       # Card header component
│   │   │   └── NewItemMenu.tsx      # Card creation menu
│   │   ├── ui/                   # Reusable UI components (shadcn/ui)
│   │   └── empty-state.tsx       # Empty state component
│   ├── hooks/                    # Custom React hooks
│   │   └── use-media-query.ts    # Media query hook
│   └── lib/                      # Utility libraries
│       ├── canvas/               # Canvas state management
│       │   ├── state.ts          # State initialization
│       │   ├── types.ts          # TypeScript types
│       │   └── updates.ts        # State update helpers
│       └── utils.ts              # General utilities
│
├── agent/                        # Backend Python agent
│   └── agent/                    # Agent module
│       ├── __init__.py           # Package initialization
│       ├── agent.py              # LlamaIndex agent with tools
│       ├── server.py             # FastAPI server setup
│       ├── sheets_integration.py # Google Sheets integration logic
│       └── docs_integration.py   # Google Docs integration logic
│
├── public/                       # Static assets
├── .env                          # Frontend environment variables
├── agent/.env                    # Backend environment variables
├── package.json                  # Node.js dependencies
├── agent/pyproject.toml          # Python dependencies
└── README.md                     # Project documentation
```

## Module Responsibilities

### Frontend (`src/`)

#### `src/app/page.tsx` (Main Canvas Page)
**Responsibility:** Primary application UI and orchestration
- Manages canvas state using `useCoAgent` hook (bidirectional sync with agent)
- Implements all frontend CopilotKit actions (createItem, deleteItem, setFields, etc.)
- Handles Google Sheets integration UI (modals, import/export)
- Renders card grid with real-time updates
- Provides JSON view toggle
- Implements auto-sync to Google Sheets when `syncSheetId` is set
- Handles Human-in-the-Loop (HITL) interactions via `renderAndWaitForResponse`

#### `src/app/layout.tsx`
**Responsibility:** Root layout and providers
- Sets up CopilotKit provider with runtime configuration
- Configures theme and global fonts
- Wraps entire application

#### `src/app/api/copilotkit/route.ts`
**Responsibility:** CopilotKit runtime proxy
- Forwards CopilotKit requests to backend agent
- Handles authentication and request routing

#### `src/app/api/sheets/` (API Routes)
**Responsibility:** Google Sheets REST API endpoints
- **`create/route.ts`**: Creates new Google Sheet
- **`import/route.ts`**: Imports data from Google Sheet to canvas
- **`list/route.ts`**: Lists available sheet tabs/worksheets
- **`sync/route.ts`**: Syncs canvas state to Google Sheet

#### `src/app/api/docs/` (API Routes)
**Responsibility:** Google Docs REST API endpoints
- **`create/route.ts`**: Creates new Google Doc
- **`import/route.ts`**: Imports data from Google Doc to canvas
- **`export/route.ts`**: Exports canvas state to Google Doc

#### `src/components/canvas/`
**Responsibility:** Canvas-specific UI components

- **`CardRenderer.tsx`**: Renders different card types (project, entity, note, chart)
  - Handles field editing for each card type
  - Manages checklists, tags, charts, and dates
  - Provides inline editing capabilities

- **`ItemHeader.tsx`**: Card header with name and subtitle
  - Editable title and subtitle fields
  - Responsive styling

- **`NewItemMenu.tsx`**: Dropdown menu for creating new cards
  - Provides card type selection (project, entity, note, chart)
  - Triggers item creation

- **`AppChatHeader.tsx`**: Chat sidebar header component
  - Displays agent/chat branding

#### `src/components/ui/`
**Responsibility:** Reusable UI primitives
- shadcn/ui components (button, dropdown-menu, accordion, avatar, progress, etc.)
- Styled with Tailwind CSS and Radix UI

#### `src/lib/canvas/`
**Responsibility:** Canvas state management and types

- **`types.ts`**: TypeScript type definitions
  - `AgentState`: Global canvas state
  - `Item`, `CardType`: Card definitions
  - `ProjectData`, `EntityData`, `NoteData`, `ChartData`: Card-specific data structures
  - `ChecklistItem`, `ChartMetric`: Nested data structures

- **`state.ts`**: State initialization
  - `initialState`: Default empty canvas state
  - State validation helpers

- **`updates.ts`**: State update helper functions
  - Checklist CRUD operations
  - Chart metric operations
  - Immutable state update patterns

#### `src/lib/utils.ts`
**Responsibility:** General utility functions
- `cn()`: Class name merging with tailwind-merge
- `getContentArg()`: Helper for extracting content from action arguments

#### `src/hooks/use-media-query.ts`
**Responsibility:** Responsive design helper
- Detects screen size for desktop/mobile layouts
- Used for conditional CopilotChat vs CopilotPopup rendering

### Backend (`agent/`)

#### `agent/agent/agent.py` (Core Agent Logic)
**Responsibility:** LlamaIndex agent with tool definitions and system prompts
- **Frontend tool stubs**: Defines signatures for frontend actions (createItem, setProjectField1, etc.)
  - These tools are executed on the frontend but the agent knows their schemas
- **Backend tools**: Implements server-side tools
  - `list_sheet_names`: Lists available sheets in a spreadsheet
  - `convert_doc_to_canvas`: Converts Google Doc to canvas format with import instructions
  - Loads Composio tools dynamically (Google Sheets and Google Docs actions)
- **System prompt**: Comprehensive instructions for agent behavior
  - Field schema documentation
  - Mutation/tool policy
  - Google Sheets and Google Docs integration workflows
  - Strict grounding rules (always use shared state as truth)
- **Workflow router**: Creates `agentic_chat_router` with LlamaIndex's `get_ag_ui_workflow_router`
  - Integrates with CopilotKit runtime
  - Manages agent state (items, globalTitle, syncSheetId, syncDocId, etc.)

#### `agent/agent/server.py` (FastAPI Server)
**Responsibility:** HTTP server and REST API endpoints
- Initializes FastAPI app
- Includes `agentic_chat_router` from agent.py
- Provides REST endpoints for Google Sheets operations:
  - **POST `/sheets/sync`**: Syncs Google Sheet data to canvas format
  - **POST `/sync-to-sheets`**: Syncs canvas state to Google Sheets
  - **POST `/sheets/list`**: Lists available sheet names in a spreadsheet
  - **POST `/sheets/create`**: Creates a new Google Sheet
- Provides REST endpoints for Google Docs operations:
  - **POST `/docs/import`**: Imports Google Doc data to canvas format
  - **POST `/docs/export`**: Exports canvas state to Google Docs
  - **POST `/docs/create`**: Creates a new Google Doc
- Handles request validation with Pydantic models
- Extracts sheet/document IDs from URLs

#### `agent/agent/sheets_integration.py` (Google Sheets Integration)
**Responsibility:** Bidirectional Google Sheets sync logic
- **`get_composio_client()`**: Initializes Composio client
- **`get_sheet_names(sheet_id)`**: Fetches available worksheet names
- **`get_sheet_data(sheet_id, sheet_name)`**: Fetches raw sheet data via Composio
  - Calls `GOOGLESHEETS_GET_SPREADSHEET_INFO`
  - Calls `GOOGLESHEETS_BATCH_GET` for values
- **`convert_sheet_to_canvas_items(sheet_data, sheet_id)`**: Converts sheet rows to canvas items
  - Auto-detects headers
  - Determines item types (project, entity, note, chart) based on content
  - Extracts dates, tags, numeric values
  - Creates structured canvas items with proper data fields
- **`sync_canvas_to_sheet(sheet_id, canvas_state, sheet_name)`**: Syncs canvas to Google Sheets
  - Deletes extra rows when canvas has fewer items
  - Batch updates sheet with new data
  - Returns sync status
- **`create_new_sheet(title)`**: Creates a new Google Sheet via Composio
  - Returns sheet ID and URL
- **Helper functions**:
  - `determine_item_type()`: Infers card type from row content
  - `create_item_data()`: Builds card-specific data structures
  - `find_date_in_row()`, `extract_tags_from_row()`, `parse_numeric_value()`: Data extraction utilities

#### `agent/agent/docs_integration.py` (Google Docs Integration)
**Responsibility:** Bidirectional Google Docs sync logic
- **`get_composio_client()`**: Initializes Composio client for Google Docs operations
- **`get_document_content(doc_id)`**: Fetches Google Doc content via Composio
  - Calls `GOOGLEDOCS_GET_DOCUMENT_BY_ID`
  - Returns document structure with title, body, and raw data
- **`extract_text_from_document(doc_data)`**: Extracts plain text from Google Docs structure
  - Processes paragraphs, text runs, and tables
  - Handles nested document elements
  - Returns formatted plain text content
- **`convert_document_to_canvas_items(doc_data, doc_id)`**: Converts Google Doc to canvas format
  - Auto-detects document sections and headings
  - Determines item types based on content analysis
  - Creates structured canvas items with proper data fields
  - Sets `syncDocId` for document tracking
- **`parse_document_sections(text)`**: Parses plain text into logical sections
  - Identifies headings and content blocks
  - Handles various heading formats (markdown, numbered, etc.)
  - Groups related content together
- **`determine_section_type(section)`**: Infers canvas item type from section content
  - Analyzes heading keywords and content patterns
  - Returns appropriate type: project, entity, note, or chart
- **`create_section_data(item_type, section)`**: Builds type-specific data structures
  - Creates checklist items from bullet points for projects
  - Extracts tags and metadata for entities
  - Formats content appropriately for each card type
- **`create_new_document(title)`**: Creates new Google Doc via Composio
  - Calls `GOOGLEDOCS_CREATE_DOCUMENT`
  - Returns document ID and URL
- **`write_canvas_to_document(doc_id, canvas_state)`**: Exports canvas to Google Doc
  - Converts canvas items to structured document format
  - Handles different item types with appropriate formatting
  - Uses `GOOGLEDOCS_UPDATE_EXISTING_DOCUMENT` for content insertion
  - Preserves item hierarchy and formatting
- **Helper functions**:
  - Content analysis for type determination
  - Text formatting and structure preservation
  - Error handling for Composio API calls

#### `agent/agent/__init__.py`
**Responsibility:** Package initialization
- Exports `main()` function for `uv run dev` command
- Starts Uvicorn server on port 9000

## Data Flow

### 1. Canvas State Synchronization
```
User interaction → Frontend state update → useCoAgent hook →
CopilotKit runtime → Backend agent → Agent processes →
State update → CopilotKit runtime → Frontend state sync → UI update
```

### 2. AI Agent Interaction
```
User message in chat → CopilotKit → Backend agent →
LLM (GPT-4.1) processes with system prompt →
Agent calls tools (frontend or backend) →
Tool execution → Results returned to agent →
Agent responds → CopilotKit → UI update
```

### 3. Google Sheets Import
```
User provides sheet ID → Frontend calls /api/sheets/import →
Backend calls get_sheet_data() → Composio API calls →
Google Sheets API → Data returned →
convert_sheet_to_canvas_items() processes →
Canvas state updated → Auto-sync enabled with syncSheetId
```

### 4. Google Sheets Auto-Sync (Bidirectional)
```
Canvas state change → useEffect triggers debounced sync →
Frontend calls /api/sheets/sync →
Backend calls sync_canvas_to_sheet() →
Composio API updates Google Sheet →
Confirmation returned
```

### 5. Google Docs Import
```
User provides doc ID → Frontend calls /api/docs/import →
Backend calls get_document_content() → Composio API calls →
Google Docs API → Document data returned →
convert_document_to_canvas_items() processes →
Canvas state updated → Auto-sync enabled with syncDocId
```

### 6. Google Docs Export
```
User triggers export → Frontend calls /api/docs/export →
Backend calls write_canvas_to_document() →
Canvas items converted to document format →
Composio API updates Google Doc →
Confirmation returned
```

## Key Design Patterns

### 1. Coagent State Management
- Frontend and backend share the same state schema (`AgentState`)
- `useCoAgent` hook provides bidirectional sync
- Agent is the source of truth; frontend reflects agent state

### 2. Tool-Based HITL (Human-in-the-Loop)
- Frontend tools use `renderAndWaitForResponse` for disambiguation
- Example: `choose_item`, `choose_card_type`
- Agent can prompt user for clarification before proceeding

### 3. Frontend vs Backend Tools
- **Frontend tools**: Executed on client for UI updates (createItem, setFields)
  - Registered with `useCopilotAction` with `available: "remote"`
  - Agent knows their signatures but execution happens on frontend
- **Backend tools**: Executed on server for data operations (Composio tools, list_sheet_names)
  - Implemented directly in agent.py

### 4. Strict Grounding
- Agent always uses shared state as ground truth
- Never hallucinates item IDs or field values
- Verifies changes after tool execution

### 5. Idempotency
- Create operations check for existing items with same type+name
- Prevents duplicate creations within short time windows
- Throttling for rapid tool calls

### 6. Auto-Sync with Google Sheets
- `syncSheetId` in state enables automatic syncing
- Frontend debounces sync requests (1 second)
- Backend handles conflict resolution (Google Sheets is source of truth)

## Environment Configuration

### Frontend (`.env`)
```
COPILOT_CLOUD_PUBLIC_API_KEY=""  # Optional: CopilotKit Cloud features
```

### Backend (`agent/.env`)
```
OPENAI_API_KEY=""                       # Required: OpenAI API key
COMPOSIO_API_KEY=""                     # Required: Composio API key
COMPOSIO_GOOGLESHEETS_AUTH_CONFIG_ID="" # Required: Composio auth config for Google Sheets
COMPOSIO_GOOGLEDOCS_AUTH_CONFIG_ID=""   # Required: Composio auth config for Google Docs
COMPOSIO_USER_ID="default"              # Required: Composio user ID
COMPOSIO_TOOL_IDS=""                    # Optional: Comma-separated tool IDs to load
```

## Running the Application

### Development
```bash
# Install all dependencies (Node.js + Python)
pnpm install  # or npm/yarn/bun

# Start both UI and agent servers
pnpm dev

# Or start individually
pnpm dev:ui      # Next.js on :3000
pnpm dev:agent   # FastAPI on :9000
```

### Production
```bash
pnpm build
pnpm start
```

## Agent Capabilities

The LlamaIndex agent can:
- Create, read, update, delete canvas items
- Set field values for projects, entities, notes, charts
- Manage checklists and tags
- Add/update chart metrics
- Import from Google Sheets
- Auto-sync changes to Google Sheets
- Create new Google Sheets
- List available worksheets
- Import from Google Docs
- Export canvas to Google Docs
- Create new Google Docs
- Execute multi-step plans with progress tracking
- Ask for user clarification when needed (HITL)

## Integration Points

### CopilotKit Integration
- Runtime at `/api/copilotkit/route.ts` proxies to agent on port 9000
- `useCoAgent` hook syncs state bidirectionally
- `useCopilotAction` registers frontend tools
- `CopilotChat` / `CopilotPopup` provides chat UI

### Composio Integration
- Dynamically loads Google Sheets and Google Docs tools via `COMPOSIO_TOOL_IDS`
- Handles authentication via `COMPOSIO_GOOGLESHEETS_AUTH_CONFIG_ID` and `COMPOSIO_GOOGLEDOCS_AUTH_CONFIG_ID`
- Executes Google Sheets operations:
  - `GOOGLESHEETS_GET_SPREADSHEET_INFO`
  - `GOOGLESHEETS_BATCH_GET`
  - `GOOGLESHEETS_BATCH_UPDATE`
  - `GOOGLESHEETS_DELETE_DIMENSION`
  - `GOOGLESHEETS_CREATE_GOOGLE_SHEET1`
- Executes Google Docs operations:
  - `GOOGLEDOCS_GET_DOCUMENT_BY_ID`
  - `GOOGLEDOCS_CREATE_DOCUMENT`
  - `GOOGLEDOCS_UPDATE_EXISTING_DOCUMENT`
- Common operations:
  - `COMPOSIO_CHECK_ACTIVE_CONNECTION`
  - `COMPOSIO_INITIATE_CONNECTION`

### LlamaIndex Integration
- Uses `get_ag_ui_workflow_router` for agentic workflow
- Workflow context manages agent state
- OpenAI LLM (GPT-4.1) for natural language understanding
- FunctionTool for custom backend tools

## Card Types and Fields

### Project
- `field1`: Text (description)
- `field2`: Select (Option A/B/C)
- `field3`: Date (YYYY-MM-DD)
- `field4`: Checklist items (id, text, done, proposed)

### Entity
- `field1`: Text (description)
- `field2`: Select (Option A/B/C)
- `field3`: Tags (array of strings)
- `field3_options`: Available tags

### Note
- `field1`: Long text (textarea)

### Chart
- `field1`: Metrics array (id, label, value 0-100)

## Security Considerations

- Never log or expose API keys
- Validate all input from frontend and Google Sheets
- Use environment variables for sensitive configuration
- Composio handles OAuth for Google Sheets
- Agent enforces strict grounding to prevent hallucination

## Future Extensibility

To extend the application:

1. **Add new card types**: Update `types.ts`, `CardRenderer.tsx`, `agent.py` field schema, and frontend actions
2. **Add new integrations**: Use Composio to add more tools (Slack, Notion, GitHub, etc.)
3. **Customize agent behavior**: Modify system prompt in `agent.py`
4. **Add authentication**: Integrate user auth and multi-tenancy
5. **Enhance UI**: Customize components in `src/components/`
6. **Add backend logic**: Implement new tools in `agent.py` or new FastAPI endpoints in `server.py`