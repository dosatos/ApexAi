```mermaidjs
flowchart TD
    %% User Interface Layer
    User["👤 User"] --> UI["🎨 Next.js Frontend<br/>React 19 + TypeScript<br/>📁 src/app/layout.tsx"]
    
    %% Frontend Components
    UI --> Canvas["📋 Canvas Page<br/>useCoAgent Hook<br/>📁 src/app/page.tsx<br/>(MAIN UI FILE)"]
    UI --> Chat["💬 CopilotChat/Popup<br/>AI Interface<br/>📁 src/app/page.tsx<br/>(CopilotChat component)"]
    UI --> Cards["🎴 Card Components<br/>Project/Entity/Note/Chart<br/>📁 src/components/canvas/CardRenderer.tsx"]
    UI --> Sheets["📊 Google Sheets UI<br/>Import/Export Modals<br/>📁 src/app/page.tsx<br/>(Import/Export UI)"]
    
    %% Frontend State Management
    Canvas --> State["🔄 Canvas State<br/>AgentState + Items<br/>📁 src/lib/canvas/state.ts<br/>📁 src/lib/canvas/types.ts"]
    State --> CardTypes{"Card Types<br/>📁 src/lib/canvas/types.ts"}
    CardTypes --> Project["📋 Project<br/>field1-4, checklist<br/>📁 src/lib/canvas/types.ts<br/>(ProjectData)"]
    CardTypes --> Entity["🏢 Entity<br/>description, tags<br/>📁 src/lib/canvas/types.ts<br/>(EntityData)"]
    CardTypes --> Note["📝 Note<br/>long text<br/>📁 src/lib/canvas/types.ts<br/>(NoteData)"]
    CardTypes --> Chart["📊 Chart<br/>metrics array<br/>📁 src/lib/canvas/types.ts<br/>(ChartData)"]
    
    %% CopilotKit Integration
    Chat --> CopilotKit["⚡ CopilotKit Runtime<br/>/api/copilotkit<br/>📁 src/app/api/copilotkit/route.ts"]
    CopilotKit --> Proxy["🔄 Runtime Proxy<br/>Port 3000 → 9000<br/>📁 src/app/api/copilotkit/route.ts<br/>(Proxy logic)"]
    
    %% Backend Agent Layer
    Proxy --> Agent["🤖 LlamaIndex Agent<br/>Python FastAPI<br/>📁 agent/agent/agent.py<br/>(CORE AGENT)"]
    Agent --> LLM["🧠 OpenAI GPT-4.1<br/>Natural Language Processing<br/>📁 agent/agent/agent.py<br/>(LLM integration)"]
    Agent --> Tools{"🛠️ Tool Router<br/>📁 agent/agent/agent.py<br/>(Tool definitions)"}
    
    %% Frontend Tools Remote Execution
    Tools --> FrontendTools["🎯 Frontend Tools<br/>available: remote<br/>📁 src/app/page.tsx<br/>(useCopilotAction)"]
    FrontendTools --> CreateItem["➕ createItem<br/>📁 src/app/page.tsx<br/>(createItem action)"]
    FrontendTools --> SetFields["✏️ setProjectField1-4<br/>setEntityField1-3<br/>setNoteField1<br/>setChartField1<br/>📁 src/app/page.tsx<br/>(setField actions)"]
    FrontendTools --> DeleteItem["🗑️ deleteItem<br/>📁 src/app/page.tsx<br/>(deleteItem action)"]
    FrontendTools --> HITL["❓ Human-in-the-Loop<br/>choose_item, choose_card_type<br/>📁 src/app/page.tsx<br/>(HITL actions)"]
    
    %% Backend Tools Server Execution
    Tools --> BackendTools["⚙️ Backend Tools<br/>Server-side execution<br/>📁 agent/agent/agent.py<br/>(Backend tool implementations)"]
    BackendTools --> ListSheets["📋 list_sheet_names<br/>📁 agent/agent/agent.py<br/>(list_sheet_names function)"]
    BackendTools --> ComposioTools["🔌 Composio Tools<br/>Google Sheets Integration<br/>📁 agent/agent/agent.py<br/>(Composio tool loading)"]
    
    %% Google Sheets Integration
    ComposioTools --> Composio["🔌 Composio API<br/>Authentication & Tools<br/>📁 agent/agent/sheets_integration.py<br/>(get_composio_client)"]
    Composio --> GoogleAPI["📊 Google Sheets API<br/>Read/Write Operations<br/>📁 agent/agent/sheets_integration.py<br/>(Sheet operations)"]
    
    %% Google Sheets Operations
    GoogleAPI --> SheetOps{"Sheet Operations<br/>📁 agent/agent/sheets_integration.py"}
    SheetOps --> GetSheet["📖 GET_SPREADSHEET_INFO<br/>BATCH_GET<br/>📁 agent/agent/sheets_integration.py<br/>(get_sheet_data)"]
    SheetOps --> UpdateSheet["✏️ BATCH_UPDATE<br/>DELETE_DIMENSION<br/>📁 agent/agent/sheets_integration.py<br/>(sync_canvas_to_sheet)"]
    SheetOps --> CreateSheet["➕ CREATE_GOOGLE_SHEET<br/>📁 agent/agent/sheets_integration.py<br/>(create_new_sheet)"]
    
    %% Backend REST API
    Agent --> FastAPI["🚀 FastAPI Server<br/>Port 9000<br/>📁 agent/agent/server.py<br/>(MAIN SERVER)"]
    FastAPI --> RestEndpoints{"📡 REST Endpoints<br/>📁 agent/agent/server.py"}
    RestEndpoints --> SheetsAPI["📊 /api/sheets/*<br/>📁 src/app/api/sheets/"]
    SheetsAPI --> Import["📥 /import - Sheet to Canvas<br/>📁 src/app/api/sheets/import/route.ts"]
    SheetsAPI --> Sync["🔄 /sync - Canvas to Sheet<br/>📁 src/app/api/sheets/sync/route.ts"]
    SheetsAPI --> List["📋 /list - Available Sheets<br/>📁 src/app/api/sheets/list/route.ts"]
    SheetsAPI --> Create["➕ /create - New Sheet<br/>📁 src/app/api/sheets/create/route.ts"]
    
    %% Data Flow Patterns
    State -.->|"Auto-sync when<br/>syncSheetId set<br/>📁 src/app/page.tsx<br/>(useEffect sync)"| Sync
    Import -.->|"Converts sheet data<br/>to canvas items<br/>📁 agent/agent/sheets_integration.py<br/>(convert_sheet_to_canvas_items)"| State
    LLM -.->|"System Prompt<br/>Field Schemas<br/>Grounding Rules<br/>📁 agent/agent/agent.py<br/>(System prompt)"| Tools
    
    %% Bidirectional Sync
    Canvas -.->|"State Changes<br/>Debounced 1s<br/>📁 src/app/page.tsx<br/>(Debounced sync)"| Sync
    GetSheet -.->|"Import Data<br/>Auto-detect Types<br/>📁 agent/agent/sheets_integration.py<br/>(Type detection)"| Import
    
    %% External Services
    GoogleAPI --> GoogleSheets[("📊 Google Sheets<br/>User's Spreadsheets<br/>🌐 External API")]
    LLM --> OpenAI[("🌐 OpenAI API<br/>GPT-4.1 Model<br/>🌐 External API")]
    Composio --> ComposioService[("🔌 Composio Platform<br/>Tool Integrations<br/>🌐 External API")]
    
    %% Environment Configuration
    Agent -.->|"OPENAI_API_KEY<br/>COMPOSIO_API_KEY<br/>COMPOSIO_GOOGLESHEETS_AUTH_CONFIG_ID<br/>📁 agent/.env"| EnvVars["⚙️ Environment<br/>Variables<br/>📁 .env (frontend)<br/>📁 agent/.env (backend)"]
    UI -.->|"COPILOT_CLOUD_PUBLIC_API_KEY<br/>📁 .env"| EnvVars
    
    %% Key Data Structures
    State --> ItemTypes{"Item Structure<br/>📁 src/lib/canvas/types.ts<br/>(Type definitions)"}
    ItemTypes --> ItemID["🆔 id: string<br/>📁 src/lib/canvas/types.ts<br/>(Item interface)"]
    ItemTypes --> ItemName["📝 name: string<br/>📁 src/lib/canvas/types.ts<br/>(Item interface)"]
    ItemTypes --> ItemType["🏷️ type: CardType<br/>📁 src/lib/canvas/types.ts<br/>(CardType enum)"]
    ItemTypes --> ItemData["📊 data: TypeSpecificData<br/>📁 src/lib/canvas/types.ts<br/>(Data interfaces)"]
    
    %% Additional File References
    Cards --> ItemHeader["📝 Card Header<br/>📁 src/components/canvas/ItemHeader.tsx"]
    Cards --> NewItemMenu["➕ New Item Menu<br/>📁 src/components/canvas/NewItemMenu.tsx"]
    State --> Updates["⚙️ State Updates<br/>📁 src/lib/canvas/updates.ts<br/>(Helper functions)"]
    UI --> Utils["🛠️ Utilities<br/>📁 src/lib/utils.ts<br/>📁 src/hooks/use-media-query.ts"]
    
    %% Package Management
    FastAPI --> PyProject["📦 Python Dependencies<br/>📁 agent/pyproject.toml"]
    UI --> PackageJson["📦 Node.js Dependencies<br/>📁 package.json"]
    
    %% Styling
    classDef frontend fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef backend fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef agent fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef data fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    classDef files fill:#f1f8e9,stroke:#33691e,stroke-width:2px
    
    class UI,Canvas,Chat,Cards,Sheets,State,CopilotKit,ItemHeader,NewItemMenu,Updates,Utils,PackageJson frontend
    class Agent,FastAPI,RestEndpoints,BackendTools,ComposioTools,PyProject backend
    class LLM,Tools,FrontendTools,HITL agent
    class GoogleAPI,GoogleSheets,OpenAI,ComposioService,Composio external
    class ItemTypes,ItemID,ItemName,ItemType,ItemData,CardTypes data
```