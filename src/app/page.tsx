"use client";

import { useCoAgent, useCopilotAction, useCopilotAdditionalInstructions } from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotChat, CopilotPopup } from "@copilotkit/react-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { Button } from "@/components/ui/button"
import AppChatHeader, { PopupHeader } from "@/components/canvas/AppChatHeader";
import { X } from "lucide-react"
import CardRenderer from "@/components/canvas/CardRenderer";
import ShikiHighlighter from "react-shiki/web";
import { motion, useScroll, useTransform, useMotionValueEvent } from "motion/react";
import { EmptyState } from "@/components/empty-state";
import { cn, getContentArg } from "@/lib/utils";
import type { AgentState, Item, ItemData, DocumentData, CardType } from "@/lib/canvas/types";
import { initialState, isNonEmptyAgentState, defaultDataFor } from "@/lib/canvas/state";
import { updateDocumentContent } from "@/lib/canvas/updates";
import useMediaQuery from "@/hooks/use-media-query";
import ItemHeader from "@/components/canvas/ItemHeader";
import NewItemMenu from "@/components/canvas/NewItemMenu";

export default function CopilotKitPage() {
  const { state, setState } = useCoAgent<AgentState>({
    name: "sample_agent",
    initialState,
  });


  // Global cache for the last non-empty agent state
  const cachedStateRef = useRef<AgentState>(state ?? initialState);
  useEffect(() => {
    if (isNonEmptyAgentState(state)) {
      cachedStateRef.current = state as AgentState;
    }
  }, [state]);
  // we use viewState to avoid transient flicker; TODO: troubleshoot and remove this workaround
  const viewState: AgentState = isNonEmptyAgentState(state) ? (state as AgentState) : cachedStateRef.current;

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [showJsonView, setShowJsonView] = useState<boolean>(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const { scrollY } = useScroll({ container: scrollAreaRef });
  const headerScrollThreshold = 64;
  const headerOpacity = useTransform(scrollY, [0, headerScrollThreshold], [1, 0]);
  const [headerDisabled, setHeaderDisabled] = useState<boolean>(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const descTextareaRef = useRef<HTMLInputElement | null>(null);
  const lastCreationRef = useRef<{ type: CardType; name: string; id: string; ts: number } | null>(null);

  useMotionValueEvent(scrollY, "change", (y) => {
    const disable = y >= headerScrollThreshold;
    setHeaderDisabled(disable);
    if (disable) {
      titleInputRef.current?.blur();
      descTextareaRef.current?.blur();
    }
  });

  useEffect(() => {
    console.log("[CoAgent state updated]", state);

    // Auto-sync to Google Sheets if syncSheetId is present
    const autoSyncToSheets = async () => {
      console.log("[AUTO-SYNC] Checking sync conditions:", {
        hasState: !!state,
        syncSheetId: state?.syncSheetId,
        itemsLength: state?.items?.length || 0
      });

      if (!state || !state.syncSheetId) {
        console.log("[AUTO-SYNC] Skipping - no sheet configured");
        return; // No sync needed - no sheet configured
      }

      try {
        console.log(`[AUTO-SYNC] Syncing ${state.items?.length || 0} items to sheet: ${state.syncSheetId}`);

        const response = await fetch('/api/sheets/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            canvas_state: state,
            sheet_id: state.syncSheetId,
            sheet_name: state.syncSheetName,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('[AUTO-SYNC] ✅ Successfully synced to Google Sheets:', result.message);
        } else {
          const error = await response.json();
          console.warn('[AUTO-SYNC] ❌ Failed to sync to Google Sheets:', error.error);
        }
      } catch (error) {
        console.warn('[AUTO-SYNC] ❌ Exception during auto-sync:', error);
      }
    };

    // Debounce the sync to avoid too many requests
    const timeoutId = setTimeout(autoSyncToSheets, 1000);
    return () => clearTimeout(timeoutId);
  }, [state]);

  // Reset JSON view when there are no items
  useEffect(() => {
    const itemsCount = (viewState?.items ?? []).length;
    if (itemsCount === 0 && showJsonView) {
      setShowJsonView(false);
    }
  }, [viewState?.items, showJsonView]);



  const getStatePreviewJSON = (s: AgentState | undefined): Record<string, unknown> => {
    const snapshot = (s ?? initialState) as AgentState;
    const { globalTitle, globalDescription, items } = snapshot;
    return {
      globalTitle: globalTitle ?? initialState.globalTitle,
      globalDescription: globalDescription ?? initialState.globalDescription,
      items: items ?? initialState.items,
    };
  };


  // Strengthen grounding: always prefer shared state over chat history
  useCopilotAdditionalInstructions({
    instructions: (() => {
      const items = viewState.items ?? initialState.items;
      const gTitle = viewState.globalTitle ?? "";
      const gDesc = viewState.globalDescription ?? "";
      const summary = items
        .slice(0, 5)
        .map((p: Item) => `id=${p.id} • name=${p.name} • type=${p.type}`)
        .join("\n");
      const fieldSchema = [
        "FIELD SCHEMA (authoritative):",
        "- document.data:",
        "  - content: string (rich text content)",
        "  - createdAt: string (ISO timestamp)",
        "  - modifiedAt: string (ISO timestamp)",
        "  - wordCount: number (automatic word count)",
      ].join("\n");
      const toolUsageHints = [
        "TOOL USAGE HINTS:",
        "- To create documents, call createItem with { name?: string } and use returned id.",
        "- Use setDocumentContent to update document content.",
        "- Use appendDocumentContent to add text to existing content.",
        "- Use clearDocumentContent to clear all content.",
        "- Document subtitle/description keywords map to setItemSubtitleOrDescription.",
        "LOOP CONTROL: When asked to 'add a couple' items, add at most 2 and stop. Avoid repeated calls to the same mutating tool in one turn.",
        "RANDOMIZATION: If the user specifically asks for random/mock values, you MAY generate and set them right away using the tools (do not block for more details).",
        "VERIFICATION: After tools run, re-read the latest state and confirm what actually changed.",
      ].join("\n");
      return [
        "ALWAYS ANSWER FROM SHARED STATE (GROUND TRUTH).",
        "If a command does not specify which item to change, ask the user to clarify before proceeding.",
        `Global Title: ${gTitle || "(none)"}`,
        `Global Description: ${gDesc || "(none)"}`,
        "Items (sample):",
        summary || "(none)",
        fieldSchema,
        toolUsageHints,
      ].join("\n");
    })(),
  });

  // Tool-based HITL: choose item
  useCopilotAction({
    name: "choose_item",
    description: "Ask the user to choose an item id from the canvas.",
    available: "remote",
    parameters: [
      { name: "content", type: "string", required: false, description: "Prompt to display." },
    ],
    renderAndWaitForResponse: ({ respond, args }) => {
      const items = viewState.items ?? initialState.items;
      if (!items.length) {
        return (
          <div className="rounded-md border bg-white p-4 text-sm shadow">
            <p>No items available.</p>
          </div>
        );
      }
      let selectedId = items[0].id;
      return (
        <div className="rounded-md border bg-white p-4 text-sm shadow">
          <p className="mb-2 font-medium">Select an item</p>
          <p className="mb-3 text-xs text-gray-600">{getContentArg(args) ?? "Which item should I use?"}</p>
          <select
            className="w-full rounded border px-2 py-1"
            defaultValue={selectedId}
            onChange={(e) => {
              selectedId = e.target.value;
            }}
          >
            {(items).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.id})
              </option>
            ))}
          </select>
          <div className="mt-3 flex justify-end gap-2">
            <button className="rounded border px-3 py-1" onClick={() => respond?.("")}>Cancel</button>
            <button className="rounded border bg-blue-600 px-3 py-1 text-white" onClick={() => respond?.(selectedId)}>Use item</button>
          </div>
        </div>
      );
    },
  });

  // Tool-based HITL: choose card type
  useCopilotAction({
    name: "choose_card_type",
    description: "Ask the user to choose a card type to create.",
    available: "remote",
    parameters: [
      { name: "content", type: "string", required: false, description: "Prompt to display." },
    ],
    renderAndWaitForResponse: ({ respond, args }) => {
      const options: { id: CardType; label: string }[] = [
        { id: "document", label: "Document" },
      ];
      let selected: CardType | "" = "";
      return (
        <div className="rounded-md border bg-white p-4 text-sm shadow">
          <p className="mb-2 font-medium">Create a document</p>
          <p className="mb-3 text-xs text-gray-600">{getContentArg(args) ?? "I'll create a new document for you."}</p>
          <select
            className="w-full rounded border px-2 py-1"
            defaultValue=""
            onChange={(e) => {
              selected = e.target.value as CardType;
            }}
          >
            <option value="" disabled>Select an item type…</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <div className="mt-3 flex justify-end gap-2">
            <button className="rounded border px-3 py-1" onClick={() => respond?.("")}>Cancel</button>
            <button
              className="rounded border bg-blue-600 px-3 py-1 text-white"
              onClick={() => selected && respond?.(selected)}
              disabled={!selected}
            >
              Create Document
            </button>
          </div>
        </div>
      );
    },
  });

  const updateItem = useCallback(
    (itemId: string, updates: Partial<Item>) => {
      setState((prev) => {
        const base = prev ?? initialState;
        const items: Item[] = base.items ?? [];
        const nextItems = items.map((p) => (p.id === itemId ? { ...p, ...updates } : p));
        return { ...base, items: nextItems } as AgentState;
      });
    },
    [setState]
  );

  const updateItemData = useCallback(
    (itemId: string, updater: (prev: ItemData) => ItemData) => {
      setState((prev) => {
        const base = prev ?? initialState;
        const items: Item[] = base.items ?? [];
        const nextItems = items.map((p) => (p.id === itemId ? { ...p, data: updater(p.data) } : p));
        return { ...base, items: nextItems } as AgentState;
      });
    },
    [setState]
  );

  const deleteItem = useCallback((itemId: string) => {
    setState((prev) => {
      const base = prev ?? initialState;
      const existed = (base.items ?? []).some((p) => p.id === itemId);
      const items: Item[] = (base.items ?? []).filter((p) => p.id !== itemId);
      return { ...base, items, lastAction: existed ? `deleted:${itemId}` : `not_found:${itemId}` } as AgentState;
    });
  }, [setState]);

  // Checklist item local helper removed; Copilot actions handle checklist CRUD

  const toggleTag = useCallback((itemId: string, tag: string) => {
    updateItemData(itemId, (prev) => {
      const anyPrev = prev as { field3?: string[] };
      if (Array.isArray(anyPrev.field3)) {
        const selected = new Set<string>(anyPrev.field3 ?? []);
        if (selected.has(tag)) selected.delete(tag); else selected.add(tag);
        return { ...prev, field3: Array.from(selected) };
      }
      return prev;
    });
  }, [updateItemData]);

  // Remove checklist item local helper removed; use Copilot action instead


  const addItem = useCallback((type: CardType, name?: string) => {
    const t: CardType = type;
    let createdId = "";
    setState((prev) => {
      const base = prev ?? initialState;
      const items: Item[] = base.items ?? [];
      // Derive next numeric id robustly from both itemsCreated counter and max existing id
      const maxExisting = items.reduce((max, it) => {
        const parsed = Number.parseInt(String(it.id ?? "0"), 10);
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
      }, 0);
      const priorCount = Number.isFinite(base.itemsCreated) ? (base.itemsCreated as number) : 0;
      const nextNumber = Math.max(priorCount, maxExisting) + 1;
      createdId = String(nextNumber).padStart(4, "0");
      const item: Item = {
        id: createdId,
        type: t,
        name: name && name.trim() ? name.trim() : "",
        subtitle: "",
        data: defaultDataFor(),
      };
      const nextItems = [...items, item];
      return { ...base, items: nextItems, itemsCreated: nextNumber, lastAction: `created:${createdId}` } as AgentState;
    });
    return createdId;
  }, [setState]);



  // Frontend Actions (exposed as tools to the agent via CopilotKit)
  useCopilotAction({
    name: "setGlobalTitle",
    description: "Set the global title/name (outside of items).",
    available: "remote",
    parameters: [
      { name: "title", type: "string", required: true, description: "The new global title/name." },
    ],
    handler: ({ title }: { title: string }) => {
      setState((prev) => ({ ...(prev ?? initialState), globalTitle: title }));
    },
  });

  useCopilotAction({
    name: "setGlobalDescription",
    description: "Set the global description/subtitle (outside of items).",
    available: "remote",
    parameters: [
      { name: "description", type: "string", required: true, description: "The new global description/subtitle." },
    ],
    handler: ({ description }: { description: string }) => {
      setState((prev) => ({ ...(prev ?? initialState), globalDescription: description }));
    },
  });

  // Frontend Actions (item-scoped)
  useCopilotAction({
    name: "setItemName",
    description: "Set an item's name/title.",
    available: "remote",
    parameters: [
      { name: "name", type: "string", required: true, description: "The new item name/title." },
      { name: "itemId", type: "string", required: true, description: "Target item id." },
    ],
    handler: ({ name, itemId }: { name: string; itemId: string }) => {
      updateItem(itemId, { name });
    },
  });

  // Set item subtitle
  useCopilotAction({
    name: "setItemSubtitleOrDescription",
    description: "Set an item's description/subtitle (short description or subtitle).",
    available: "remote",
    parameters: [
      { name: "subtitle", type: "string", required: true, description: "The new item description/subtitle." },
      { name: "itemId", type: "string", required: true, description: "Target item id." },
    ],
    handler: ({ subtitle, itemId }: { subtitle: string; itemId: string }) => {
      updateItem(itemId, { subtitle });
    },
  });


  // Document-specific field updates
  useCopilotAction({
    name: "setDocumentContent",
    description: "Update document content.",
    available: "remote",
    parameters: [
      { name: "content", type: "string", required: true, description: "New content for the document." },
      { name: "itemId", type: "string", required: true, description: "Target item id (document)." },
    ],
    handler: ({ content, itemId }: { content: string; itemId: string }) => {
      updateItemData(itemId, (prev) => updateDocumentContent(prev as DocumentData, content));
    },
  });

  useCopilotAction({
    name: "appendDocumentContent",
    description: "Append text to document content.",
    available: "remote",
    parameters: [
      { name: "content", type: "string", required: true, description: "Text to append to the document." },
      { name: "itemId", type: "string", required: true, description: "Target item id (document)." },
      { name: "withNewline", type: "boolean", required: false, description: "If true, prefix with a newline." },
    ],
    handler: ({ content, itemId, withNewline }: { content: string; itemId: string; withNewline?: boolean }) => {
      updateItemData(itemId, (prev) => {
        const docData = prev as DocumentData;
        const existing = docData.content || "";
        const newContent = existing + (withNewline ? "\n" : "") + content;
        return updateDocumentContent(docData, newContent);
      });
    },
  });

  useCopilotAction({
    name: "clearDocumentContent",
    description: "Clear document content.",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Target item id (document)." },
    ],
    handler: ({ itemId }: { itemId: string }) => {
      updateItemData(itemId, (prev) => updateDocumentContent(prev as DocumentData, ""));
    },
  });




  useCopilotAction({
    name: "createItem",
    description: "Create a new document.",
    available: "remote",
    parameters: [
      { name: "name", type: "string", required: false, description: "Optional document name." },
    ],
    handler: ({ name }: { name?: string }) => {
      const normalized = (name ?? "").trim();

      // 1) Name-based idempotency: if a document with same name exists, return it
      if (normalized) {
        const existing = (viewState.items ?? initialState.items).find((it) => it.type === "document" && (it.name ?? "").trim() === normalized);
        if (existing) {
          return existing.id;
        }
      }
      // 2) Per-run throttle: avoid duplicate creations within a short window for identical name
      const now = Date.now();
      const recent = lastCreationRef.current;
      if (recent && recent.type === "document" && (recent.name ?? "") === normalized && now - recent.ts < 5000) {
        return recent.id;
      }
      const id = addItem("document", name);
      lastCreationRef.current = { type: "document", name: normalized, id, ts: now };
      return id;
    },
  });

  // Frontend action: delete an item by id
  useCopilotAction({
    name: "deleteItem",
    description: "Delete an item by id.",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Target item id." },
    ],
    handler: ({ itemId }: { itemId: string }) => {
      const existed = (viewState.items ?? initialState.items).some((p) => p.id === itemId);
      deleteItem(itemId);
      return existed ? `deleted:${itemId}` : `not_found:${itemId}`;
    },
  });

  // Google Sheets Integration Actions
  const [showSheetModal, setShowSheetModal] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string>("");
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("");
  const [isCreatingSheet, setIsCreatingSheet] = useState<boolean>(false);
  const [newSheetTitle, setNewSheetTitle] = useState<string>("");
  const [showFormatWarning, setShowFormatWarning] = useState<boolean>(false);
  const [formatWarningDetails, setFormatWarningDetails] = useState<{
    sheetId: string;
    sheetName?: string;
    existingFormat: string;
    canvasFormat: string;
  } | null>(null);

  // Google Docs Integration Actions
  const [showDocModal, setShowDocModal] = useState<boolean>(false);
  const [isImportingDoc, setIsImportingDoc] = useState<boolean>(false);
  const [docImportError, setDocImportError] = useState<string>("");
  const [isCreatingDoc, setIsCreatingDoc] = useState<boolean>(false);
  const [newDocTitle, setNewDocTitle] = useState<string>("");
  const [isExportingDoc, setIsExportingDoc] = useState<boolean>(false);
  const [docId, setDocId] = useState<string>("");
  const [exportDocId, setExportDocId] = useState<string>("");

  const fetchAvailableSheets = async (sheetId: string) => {
    try {
      // Extract sheet ID from URL if needed
      let cleanSheetId = sheetId.trim();
      if (cleanSheetId.includes("/spreadsheets/d/")) {
        const start = cleanSheetId.indexOf("/spreadsheets/d/") + "/spreadsheets/d/".length;
        const end = cleanSheetId.indexOf("/", start);
        cleanSheetId = cleanSheetId.substring(start, end === -1 ? undefined : end);
      }

      setImportError("");

      // Make API call to list available sheets
      const response = await fetch('/api/sheets/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sheet_id: cleanSheetId }),
      });

      if (response.ok) {
        const result = await response.json();
        const sheetNames = result.sheet_names || [];
        setAvailableSheets(sheetNames);
        if (sheetNames.length > 0) {
          setSelectedSheetName(""); // Default to first sheet
        }
      } else {
        const error = await response.json();
        setImportError(`Failed to list sheets: ${error.error}`);
      }

    } catch (error) {
      console.error('Error fetching sheets:', error);
      setImportError("Failed to fetch available sheets");
    }
  };

  const importFromSheet = async (sheetId: string, sheetName?: string, forceImport = false) => {
    if (!sheetId.trim()) {
      setImportError("Please enter a valid Sheet ID");
      return;
    }

    setIsImporting(true);
    setImportError("");

    try {
      // Extract sheet ID from URL if needed
      let cleanSheetId = sheetId.trim();
      if (cleanSheetId.includes("/spreadsheets/d/")) {
        const start = cleanSheetId.indexOf("/spreadsheets/d/") + "/spreadsheets/d/".length;
        const end = cleanSheetId.indexOf("/", start);
        cleanSheetId = cleanSheetId.substring(start, end === -1 ? undefined : end);
      }

      // Check for format compatibility if we have existing canvas data and not forcing import
      if (!forceImport && viewState.items && viewState.items.length > 0) {
        // Get a preview of what the sheet contains
        try {
          const previewResponse = await fetch('/api/sheets/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sheet_id: cleanSheetId,
              sheet_name: sheetName || selectedSheetName || undefined,
              preview_only: true
            }),
          });

          if (previewResponse.ok) {
            const previewResult = await previewResponse.json();

            // Check if the sheet has a different format than canvas
            const hasCanvasFormat = viewState.items.some(item =>
              item.type && item.type === 'document'
            );

            const sheetHasData = previewResult.data && previewResult.data.items && previewResult.data.items.length > 0;

            if (hasCanvasFormat && sheetHasData) {
              // Show format warning
              setFormatWarningDetails({
                sheetId: cleanSheetId,
                sheetName: sheetName || selectedSheetName || undefined,
                existingFormat: `${previewResult.data.items.length} items detected in sheet`,
                canvasFormat: `${viewState.items.length} items currently in canvas`
              });
              setShowFormatWarning(true);
              setIsImporting(false);
              return;
            }
          }
        } catch (previewError) {
          console.warn("Could not preview sheet format:", previewError);
          // Continue with normal import if preview fails
        }
      }

      // Make direct API call to backend for importing
      const response = await fetch('/api/sheets/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheet_id: cleanSheetId,
          sheet_name: sheetName || selectedSheetName || undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to import sheet');
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Update the canvas state with imported data
        console.log("Import result data:", result.data);
        setState(result.data);
        setShowSheetModal(false);
        setImportError("");
        console.log("Successfully imported sheet data:", result.message);
      } else {
        throw new Error(result.message || 'Failed to process sheet data');
      }

    } catch (error) {
      console.error('Import error:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import sheet');
    } finally {
      setIsImporting(false);
    }
  };

  const createNewSheet = async (title: string) => {
    if (!title.trim()) {
      setImportError("Please enter a valid sheet title");
      return;
    }

    setIsCreatingSheet(true);
    setImportError("");

    try {
      const response = await fetch('/api/sheets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to create sheet');
      }

      const result = await response.json();
      console.log("Create sheet result:", result);

      if (result.success) {
        const sheetId = result.sheet_id;
        const sheetUrl = result.sheet_url;

        if (!sheetId) {
          console.warn("Sheet creation succeeded but no sheet_id returned");
          setImportError("Sheet was created but ID not returned. Check your Google Drive.");
          return;
        }

        // If we have existing items, sync them to the new sheet first, then set up for bi-directional sync
        if (viewState.items && viewState.items.length > 0) {
          try {
            const syncResponse = await fetch('/api/sheets/sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                canvas_state: viewState,
                sheet_id: sheetId,
              }),
            });

            if (syncResponse.ok) {
              console.log("Successfully synced existing items to new sheet");
              // Set the newly created sheet as the sync target and update title/description
              setState((prev) => ({
                ...prev,
                items: prev?.items || [],
                itemsCreated: prev?.itemsCreated || 0,
                globalTitle: result.title || title.trim(),
                globalDescription: `Connected to Google Sheet: ${result.title || title.trim()}`,
                syncSheetId: sheetId,
                syncSheetName: "Sheet1"
              }));
            } else {
              console.warn("Failed to sync existing items to new sheet");
            }
          } catch (syncError) {
            console.warn("Failed to sync existing items to new sheet:", syncError);
          }
        } else {
          // No existing items - import the empty sheet structure into canvas
          try {
            const importResponse = await fetch('/api/sheets/import', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sheet_id: sheetId,
                sheet_name: "Sheet1"
              }),
            });

            if (importResponse.ok) {
              const importResult = await importResponse.json();
              if (importResult.success && importResult.data) {
                // Update canvas state with the imported (likely empty) structure and set title/description
                setState({
                  ...importResult.data,
                  globalTitle: result.title || title.trim(),
                  globalDescription: `Connected to Google Sheet: ${result.title || title.trim()}`,
                  syncSheetId: sheetId,
                  syncSheetName: "Sheet1"
                });
                console.log("Successfully imported new sheet structure into canvas");
              }
            }
          } catch (importError) {
            console.warn("Failed to import new sheet structure:", importError);
            // Fallback: just set sync info and update title/description
            setState((prev) => ({
              ...initialState,
              ...prev,
              globalTitle: result.title || title.trim(),
              globalDescription: `Connected to Google Sheet: ${result.title || title.trim()}`,
              syncSheetId: sheetId,
              syncSheetName: "Sheet1"
            }));
          }
        }

        setShowSheetModal(false);
        setImportError("");
        console.log("Successfully created new sheet:", result.message);

        // Show success message or provide link
        if (sheetUrl) {
          window.open(sheetUrl, '_blank');
        }

      } else {
        throw new Error('Failed to create sheet: ' + (result.error || result.message || 'Unknown error'));
      }

    } catch (error) {
      console.error('Create sheet error:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to create sheet');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Google Docs Integration Functions
  const importFromDoc = async (docId: string) => {
    if (!docId.trim()) {
      setDocImportError("Please enter a valid Document ID");
      return;
    }

    setIsImportingDoc(true);
    setDocImportError("");

    try {
      // Extract doc ID from URL if needed
      let cleanDocId = docId.trim();
      if (cleanDocId.includes("/document/d/")) {
        const start = cleanDocId.indexOf("/document/d/") + "/document/d/".length;
        const end = cleanDocId.indexOf("/", start);
        cleanDocId = cleanDocId.substring(start, end === -1 ? undefined : end);
      }

      // Make direct API call to backend for importing
      const response = await fetch('/api/docs/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doc_id: cleanDocId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to import document');
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Update the canvas state with imported data
        console.log("Import result data:", result.data);
        setState(result.data);
        setShowDocModal(false);
        setDocImportError("");
        console.log("Successfully imported document data:", result.message);
      } else {
        throw new Error(result.message || 'Failed to process document data');
      }

    } catch (error) {
      console.error('Import error:', error);
      setDocImportError(error instanceof Error ? error.message : 'Failed to import document');
    } finally {
      setIsImportingDoc(false);
    }
  };

  const createNewDoc = async (title: string) => {
    if (!title.trim()) {
      setDocImportError("Please enter a valid document title");
      return;
    }

    setIsCreatingDoc(true);
    setDocImportError("");

    try {
      const response = await fetch('/api/docs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to create document');
      }

      const result = await response.json();
      console.log("Create doc result:", result);

      if (result.success) {
        const docId = result.doc_id;
        const docUrl = result.doc_url;

        if (!docId) {
          console.warn("Document creation succeeded but no doc_id returned");
          setDocImportError("Document was created but ID not returned. Check your Google Drive.");
          return;
        }

        // Export current canvas to the new doc if we have items
        if (viewState.items && viewState.items.length > 0) {
          try {
            const exportResponse = await fetch('/api/docs/export', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                canvas_state: viewState,
                doc_id: docId,
              }),
            });

            if (exportResponse.ok) {
              console.log("Successfully exported canvas to new document");

              // Store the Google Docs ID in all exported items
              viewState.items.forEach(item => {
                if (item.type === 'document') {
                  updateItemData(item.id, (prev) => ({
                    ...prev,
                    googleDocsId: docId
                  }));
                }
              });
            } else {
              console.warn("Failed to export canvas to new document");
            }
          } catch (exportError) {
            console.warn("Failed to export canvas to new document:", exportError);
          }
        }

        setShowDocModal(false);
        setDocImportError("");
        console.log("Successfully created new document:", result.message);

        // Show success message and open doc
        if (docUrl) {
          window.open(docUrl, '_blank');
        }

      } else {
        throw new Error('Failed to create document: ' + (result.error || result.message || 'Unknown error'));
      }

    } catch (error) {
      console.error('Create document error:', error);
      setDocImportError(error instanceof Error ? error.message : 'Failed to create document');
    } finally {
      setIsCreatingDoc(false);
    }
  };

  const exportToDoc = async (docId: string) => {
    if (!docId.trim()) {
      setDocImportError("Please enter a valid Document ID");
      return;
    }

    if (!viewState.items || viewState.items.length === 0) {
      setDocImportError("No items to export. Canvas is empty.");
      return;
    }

    setIsExportingDoc(true);
    setDocImportError("");

    try {
      // Extract doc ID from URL if needed
      let cleanDocId = docId.trim();
      if (cleanDocId.includes("/document/d/")) {
        const start = cleanDocId.indexOf("/document/d/") + "/document/d/".length;
        const end = cleanDocId.indexOf("/", start);
        cleanDocId = cleanDocId.substring(start, end === -1 ? undefined : end);
      }

      const response = await fetch('/api/docs/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          canvas_state: viewState,
          doc_id: cleanDocId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to export to document');
      }

      const result = await response.json();

      if (result.success) {
        console.log("Successfully exported to document:", result.message);

        // Store the Google Docs ID in all exported items
        viewState.items?.forEach(item => {
          if (item.type === 'document') {
            updateItemData(item.id, (prev) => ({
              ...prev,
              googleDocsId: cleanDocId
            }));
          }
        });

        setShowDocModal(false);
        setDocImportError("");
      } else {
        throw new Error(result.message || 'Failed to export to document');
      }

    } catch (error) {
      console.error('Export error:', error);
      setDocImportError(error instanceof Error ? error.message : 'Failed to export to document');
    } finally {
      setIsExportingDoc(false);
    }
  };

  const saveItemToGoogleDocs = async (itemId: string) => {
    const item = viewState.items?.find(i => i.id === itemId);
    if (!item) {
      console.error("Item not found:", itemId);
      return;
    }

    const itemData = item.data as DocumentData;
    const hasGoogleDocsId = Boolean(itemData.googleDocsId);

    try {
      if (hasGoogleDocsId) {
        // Update existing document with item content
        const response = await fetch('/api/docs/update-with-item', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            doc_id: itemData.googleDocsId,
            item: item,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || errorData.error || 'Failed to update document');
        }

        const result = await response.json();
        if (result.success) {
          console.log("Successfully updated document:", result.message);
        } else {
          throw new Error(result.message || 'Failed to update document');
        }
      } else {
        // Create new document with content in one step
        const response = await fetch('/api/docs/create-with-item', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ item }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || errorData.error || 'Failed to create document');
        }

        const result = await response.json();

        if (result.success && result.doc_id) {
          // Store the Google Docs ID in the item
          updateItemData(itemId, (prev) => ({
            ...prev,
            googleDocsId: result.doc_id
          }));

          console.log("Successfully created new document with content");
        } else {
          throw new Error(result.message || 'Failed to create document');
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      // You might want to show an error toast or notification here
    }
  };

  useCopilotAction({
    name: "openSheetSelectionModal",
    description: "Open modal for selecting Google Sheets.",
    available: "remote",
    parameters: [],
    handler: () => {
      setShowSheetModal(true);
      return "sheet_modal_opened";
    },
  });

  useCopilotAction({
    name: "setSyncSheetId",
    description: "Set the Google Sheet ID for auto-sync.",
    available: "remote",
    parameters: [
      { name: "sheetId", type: "string", required: true, description: "The Google Sheet ID to sync with." },
    ],
    handler: ({ sheetId }: { sheetId: string }) => {
      setState((prev) => ({
        ...initialState,
        ...prev,
        syncSheetId: sheetId
      }));
      return `sync_sheet_set:${sheetId}`;
    },
  });

  useCopilotAction({
    name: "searchUserSheets",
    description: "Search user's Google Sheets and display them for selection.",
    available: "remote",
    parameters: [],
    handler: () => {
      // This will be handled by the agent using GOOGLESHEETS_SEARCH_SPREADSHEETS
      return "searching_sheets";
    },
  });

  useCopilotAction({
    name: "syncCanvasToSheets",
    description: "Manually sync current canvas state to Google Sheets.",
    available: "remote",
    parameters: [],
    handler: async () => {
      if (!viewState.syncSheetId) {
        return "No sync sheet ID configured. Please set a sheet ID first.";
      }

      if (!viewState.items || viewState.items.length === 0) {
        return "No items to sync. Canvas is empty.";
      }

      try {
        console.log(`[MANUAL-SYNC] Syncing ${viewState.items.length} items to sheet: ${viewState.syncSheetId}`);

        const response = await fetch('/api/sheets/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            canvas_state: viewState,
            sheet_id: viewState.syncSheetId,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          return `✅ Successfully synced ${viewState.items.length} items to Google Sheets: ${result.message}`;
        } else {
          const error = await response.json();
          return `❌ Failed to sync to Google Sheets: ${error.error}`;
        }
      } catch (error) {
        return `❌ Exception during manual sync: ${error}`;
      }
    },
  });

  useCopilotAction({
    name: "forceCanvasToSheetsSync",
    description: "Force sync current canvas state to a specific Google Sheet, even if syncSheetId is not set.",
    available: "remote",
    parameters: [
      { name: "sheetId", type: "string", required: true, description: "Google Sheet ID to sync to." },
    ],
    handler: async ({ sheetId }: { sheetId: string }) => {
      if (!viewState.items || viewState.items.length === 0) {
        return "No items to sync. Canvas is empty.";
      }

      try {
        console.log(`[FORCE-SYNC] Syncing ${viewState.items.length} items to sheet: ${sheetId}`);

        const response = await fetch('/api/sheets/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            canvas_state: viewState,
            sheet_id: sheetId,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          return `✅ Successfully force-synced ${viewState.items.length} items to Google Sheets: ${result.message}`;
        } else {
          const error = await response.json();
          return `❌ Failed to force-sync to Google Sheets: ${error.error}`;
        }
      } catch (error) {
        return `❌ Exception during force-sync: ${error}`;
      }
    },
  });

  const titleClasses = cn(
    /* base styles */
    "w-full outline-none rounded-md px-2 py-1",
    "bg-transparent placeholder:text-gray-400",
    "ring-1 ring-transparent transition-all ease-out",
    /* hover styles */
    "hover:ring-border",
    /* focus styles */
    "focus:ring-2 focus:ring-accent/50 focus:shadow-sm focus:bg-accent/10",
    "focus:shadow-accent focus:placeholder:text-accent/65 focus:text-accent",
  );

  const sheetModalInputClasses = cn(
    "w-full rounded-xl border border-border/80 bg-background px-3.5 py-2.5 text-sm text-foreground shadow-xs transition-all",
    "placeholder:text-muted-foreground/70 focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none",
    "disabled:cursor-not-allowed disabled:opacity-60"
  );

  const handleCloseSheetsModal = useCallback(() => {
    if (isImporting || isCreatingSheet) {
      return;
    }
    setShowSheetModal(false);
    setImportError("");
    setAvailableSheets([]);
    setSelectedSheetName("");
    setNewSheetTitle("");
  }, [
    isCreatingSheet,
    isImporting,
    setAvailableSheets,
    setImportError,
    setNewSheetTitle,
    setSelectedSheetName,
    setShowSheetModal,
  ]);

  const [sheetId, setSheetId] = useState<string>('')

  return (
    <div
      style={{ "--copilot-kit-primary-color": "#2563eb" } as CopilotKitCSSProperties}
      className="h-screen flex flex-col"
    >
      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Sidebar */}
        <aside className="-order-1 max-md:hidden flex flex-col min-w-80 w-[30vw] max-w-120 p-4 pr-0">
          <div className="h-full flex flex-col align-start w-full shadow-lg rounded-2xl border border-sidebar-border overflow-hidden">
            {/* Chat Header */}
            <AppChatHeader />
            {/* Chat Content - conditionally rendered to avoid duplicate rendering */}
            {isDesktop && (
              <CopilotChat
                className="flex-1 overflow-auto w-full"
                labels={{
                  title: "Agent",
                  initial:
                    "👋 Let's develop your investment thesis together. Share your research, ask questions about market analysis, or request help with due diligence documentation.",
                }}
                suggestions={[
                  {
                    title: "Create a Document",
                    message: "Create a new document.",
                  },
                  {
                    title: "Write Content",
                    message: "Help me write content for my document.",
                  },
                  {
                    title: "Edit Document",
                    message: "Update the content in my document.",
                  },
                  {
                    title: "Document Structure",
                    message: "Help me organize my document content.",
                  },
                ]}
              />
            )}
          </div>
        </aside>
        {/* Main Content */}
        <main className="relative flex flex-1 h-full">
          <div ref={scrollAreaRef} className="relative overflow-auto size-full px-4 sm:px-6 md:px-8 py-4">
            <div className={cn(
              "relative w-full h-full min-h-8",
              (showJsonView || (viewState.items ?? []).length === 0) && "flex flex-col",
            )}>
              {/* Global Title & Description (hidden in JSON view) */}
              {!showJsonView && (
                <motion.div style={{ opacity: headerOpacity }} className="sticky top-0 mb-6">
                  <input
                    ref={titleInputRef}
                    disabled={headerDisabled}
                    value={viewState?.globalTitle ?? initialState.globalTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setState((prev) => ({ ...(prev ?? initialState), globalTitle: e.target.value }))
                    }
                    placeholder="Investment thesis..."
                    className={cn(titleClasses, "text-2xl font-semibold")}
                  />
                  <input
                    ref={descTextareaRef}
                    disabled={headerDisabled}
                    value={viewState?.globalDescription ?? initialState.globalDescription}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setState((prev) => ({ ...(prev ?? initialState), globalDescription: e.target.value }))
                    }
                    placeholder="Investment thesis description..."
                    className={cn(titleClasses, "mt-2 text-sm leading-6 resize-none overflow-hidden")}
                  />
                </motion.div>
              )}

              {(viewState.items ?? []).length === 0 ? (
                <EmptyState className="flex-1">
                  <div className="mx-auto max-w-lg text-center">
                    <h2 className="text-lg font-semibold text-foreground">Nothing here yet</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Create your first item to get started.</p>
                    <div className="mt-6 flex justify-center">
                      <NewItemMenu onSelect={(t: CardType) => addItem(t)} align="center" className="md:h-10" />
                    </div>
                  </div>
                </EmptyState>
              ) : (
                <div className="flex-1 py-0 overflow-hidden">
                  {showJsonView ? (
                    <div className="pb-16 size-full">
                      <div className="rounded-2xl border shadow-sm bg-card size-full overflow-auto max-md:text-sm">
                        <ShikiHighlighter language="json" theme="github-light">
                          {JSON.stringify(getStatePreviewJSON(viewState), null, 2)}
                        </ShikiHighlighter>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 pb-20">
                      {(viewState.items ?? []).map((item) => (
                        <article key={item.id} className="relative rounded-2xl border p-5 shadow-sm transition-colors ease-out bg-card hover:border-accent/40 focus-within:border-accent/60">
                          <button
                            type="button"
                            aria-label="Delete card"
                            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-card text-gray-400 hover:bg-accent/10 hover:text-accent transition-colors"
                            onClick={() => deleteItem(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <ItemHeader
                            id={item.id}
                            name={item.name}
                            subtitle={item.subtitle}
                            description={""}
                            data={item.data as DocumentData}
                            onNameChange={(v) => updateItem(item.id, { name: v })}
                            onSubtitleChange={(v) => updateItem(item.id, { subtitle: v })}
                            onSave={() => saveItemToGoogleDocs(item.id)}
                          />

                          <div className="mt-6">
                            <CardRenderer item={item} onUpdateData={(updater) => updateItemData(item.id, updater)} onToggleTag={(tag) => toggleTag(item.id, tag)} />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {(viewState.items ?? []).length > 0 ? (
            <div className={cn(
              "absolute left-1/2 -translate-x-1/2 bottom-4",
              "inline-flex rounded-lg shadow-lg bg-card",
              "[&_button]:bg-card [&_button]:w-22 md:[&_button]:h-10",
              "[&_button]:shadow-none! [&_button]:hover:bg-accent",
              "[&_button]:hover:border-accent [&_button]:hover:text-accent",
              "[&_button]:hover:bg-accent/10!",
            )}>
              <NewItemMenu
                onSelect={(t: CardType) => addItem(t)}
                align="center"
                className="rounded-r-none border-r-0 peer"
              />
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "gap-1.25 text-base font-semibold rounded-none border-r-0",
                  "peer-hover:border-l-accent!",
                )}
                onClick={() => {
                  setShowSheetModal(true);
                }}
              >
                📊 Sheets
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "gap-1.25 text-base font-semibold rounded-none border-r-0",
                )}
                onClick={() => {
                  setShowDocModal(true);
                }}
              >
                📄 Docs
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "gap-1.25 text-base font-semibold rounded-l-none",
                )}
                onClick={() => setShowJsonView((v) => !v)}
              >
                {showJsonView
                  ? "Canvas"
                  : <>JSON</>
                }
              </Button>
            </div>
          ) : null}
        </main>
      </div>
      <div className="md:hidden">
        {/* Mobile Chat Popup - conditionally rendered to avoid duplicate rendering */}
        {!isDesktop && (
          <CopilotPopup
            Header={PopupHeader}
            labels={{
              title: "Agent",
              initial:
                "👋 Share a brief or ask to extract fields. Changes will sync with the canvas in real time.",
            }}
            suggestions={[
              {
                title: "Add a Project",
                message: "Create a new project.",
              },
              {
                title: "Add an Entity",
                message: "Create a new entity.",
              },
              {
                title: "Add a Note",
                message: "Create a new note.",
              },
              {
                title: "Add a Chart",
                message: "Create a new chart.",
              },
            ]}
          />
        )}
      </div>

      {/* Google Sheets Selection Modal */}
      {showSheetModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/75 px-4 py-10 backdrop-blur-sm sm:px-6"
          onClick={handleCloseSheetsModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheets-modal-title"
        >
          <div
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-card shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/80 bg-muted px-6 py-5 sm:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">Connections</p>
                <h2 id="sheets-modal-title" className="mt-1 text-lg font-semibold">Google Sheets</h2>
                <p className="text-sm text-muted-foreground">Sync the canvas with a Sheet—create a new one or import an existing source.</p>
              </div>
              <button
                onClick={handleCloseSheetsModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                disabled={isImporting || isCreatingSheet}
                aria-label="Close sheets modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-6 sm:px-8 sm:pb-8">
              <div className="mt-6 space-y-6">
                <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/60 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-foreground">Create a fresh Sheet</label>
                    <span className="text-xs font-medium text-muted-foreground/80">Sync starts immediately</span>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="E.g. Product Roadmap"
                      className={sheetModalInputClasses}
                      value={newSheetTitle}
                      onChange={(e) => setNewSheetTitle(e.target.value)}
                      disabled={isImporting || isCreatingSheet}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newSheetTitle.trim()) {
                          createNewSheet(newSheetTitle);
                        }
                      }}
                    />
                    <Button
                      onClick={() => {
                        if (newSheetTitle.trim()) {
                          createNewSheet(newSheetTitle);
                        }
                      }}
                      className="w-full"
                      variant="secondary"
                      disabled={isImporting || isCreatingSheet || !newSheetTitle.trim()}
                    >
                      {isCreatingSheet ? "Creating…" : "Create & Connect"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-dashed border-border/70 bg-card px-5 py-5">
                  <div className="text-sm text-foreground">
                    <span className="font-medium">Import an existing Sheet</span>
                    <p className="mt-1 text-xs text-muted-foreground">Paste a Sheet link or ID. We’ll hydrate the canvas and keep the connection live.</p>
                  </div>

                  {importError && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {importError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Sheet ID or https://docs.google.com/spreadsheets/d/..."
                      className={sheetModalInputClasses}
                      id="sheet-id-input"
                      disabled={isImporting || isCreatingSheet}
                      value={sheetId}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSheetId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const input = e.target as HTMLInputElement;
                          importFromSheet(input.value);
                        }
                      }}
                    />

                    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                      <Button
                        onClick={() => {
                          const input = document.getElementById("sheet-id-input") as HTMLInputElement;
                          if (input?.value) {
                            fetchAvailableSheets(input.value);
                          }
                        }}
                        variant="outline"
                        className="flex-1"
                        disabled={isImporting || isCreatingSheet || !sheetId}
                      >
                        List worksheets
                      </Button>
                      <Button
                        onClick={() => {
                          const input = document.getElementById("sheet-id-input") as HTMLInputElement;
                          if (input) {
                            importFromSheet(input.value);
                          }
                        }}
                        className="flex-1"
                        variant="secondary"
                        disabled={isImporting || isCreatingSheet || !availableSheets.length}
                      >
                        {isImporting ? "Importing…" : "Import to Canvas"}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <label className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-foreground">
                        Sheet tab
                        {availableSheets.length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                            {availableSheets.length} found
                          </span>
                        )}
                      </label>
                      <select
                        value={selectedSheetName}
                        onChange={(e) => setSelectedSheetName(e.target.value)}
                        className={cn(sheetModalInputClasses, "pr-8")}
                        disabled={isImporting || isCreatingSheet}
                      >
                        <option value="">
                          {availableSheets.length > 0 ? "Use first worksheet" : "List worksheets to choose a tab"}
                        </option>
                        {availableSheets.map((sheetName, index) => (
                          <option key={index} value={sheetName}>
                            {sheetName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted px-5 py-4 text-xs text-muted-foreground">
                  <p><span className="font-medium text-foreground">Heads up:</span> New Sheets open in a new tab. If you import, ensure Composio has access to the document.</p>
                  <p className="mt-2">We automatically map rows into documents so your canvas stays structured.</p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="outline"
                    className="sm:w-fit"
                    onClick={handleCloseSheetsModal}
                    disabled={isImporting || isCreatingSheet}
                  >
                    Close
                  </Button>
                  {viewState.syncSheetId && (
                    <span className="text-xs text-muted-foreground">
                      Currently linked to <span className="font-medium text-foreground">{viewState.syncSheetName || "Sheet1"}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Format Warning Modal */}
      {showFormatWarning && formatWarningDetails && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 px-4 py-8 backdrop-blur-sm sm:px-6">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-destructive/80">Import check</p>
                <h2 className="mt-1 text-lg font-semibold text-destructive">Format mismatch</h2>
                <p className="text-sm text-destructive/80">Replacing your canvas will overwrite existing cards with what’s in the Sheet.</p>
              </div>
              <button
                onClick={() => {
                  setShowFormatWarning(false);
                  setFormatWarningDetails(null);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-destructive/70 transition-colors hover:border-destructive/40 hover:text-destructive"
                aria-label="Dismiss format warning"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <p className="font-medium">Sheet details</p>
                <div className="mt-2 space-y-1 text-xs">
                  <p><span className="font-semibold uppercase tracking-wide">Sheet</span>: {formatWarningDetails.existingFormat}</p>
                  <p><span className="font-semibold uppercase tracking-wide">Canvas</span>: {formatWarningDetails.canvasFormat}</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Importing will completely replace your current canvas data with the sheet contents. Your existing cards will be lost unless they’re saved elsewhere.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <Button
                  onClick={() => {
                    setShowFormatWarning(false);
                    const details = formatWarningDetails;
                    setFormatWarningDetails(null);
                    // Force import despite format mismatch
                    importFromSheet(details.sheetId, details.sheetName, true);
                  }}
                  variant="destructive"
                  className="flex-1"
                >
                  Replace canvas with sheet
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowFormatWarning(false);
                    setFormatWarningDetails(null);
                  }}
                  className="flex-1"
                >
                  Keep current canvas
                </Button>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Tip</p>
                <p className="mt-1">Consider creating a new Sheet or exporting your canvas JSON before importing if you might need to roll back.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Docs Modal */}
      {showDocModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/75 px-4 py-10 backdrop-blur-sm sm:px-6"
          onClick={() => {
            if (!isImportingDoc && !isCreatingDoc && !isExportingDoc) {
              setShowDocModal(false);
              setDocImportError("");
              setNewDocTitle("");
              setDocId("");
              setExportDocId("");
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="docs-modal-title"
        >
          <div
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-card shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/80 bg-muted px-6 py-5 sm:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">Connections</p>
                <h2 id="docs-modal-title" className="mt-1 text-lg font-semibold">Google Docs</h2>
                <p className="text-sm text-muted-foreground">Import from or export to Google Docs—create a new doc or work with an existing one.</p>
              </div>
              <button
                onClick={() => {
                  if (!isImportingDoc && !isCreatingDoc && !isExportingDoc) {
                    setShowDocModal(false);
                    setDocImportError("");
                    setNewDocTitle("");
                    setDocId("");
                    setExportDocId("");
                  }
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                disabled={isImportingDoc || isCreatingDoc || isExportingDoc}
                aria-label="Close docs modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-6 sm:px-8 sm:pb-8">
              <div className="mt-6 space-y-6">
                {/* Create New Doc Section */}
                <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/60 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-foreground">Create & Export</label>
                    <span className="text-xs font-medium text-muted-foreground/80">New doc with canvas content</span>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="E.g. Project Overview"
                      className={sheetModalInputClasses}
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      disabled={isImportingDoc || isCreatingDoc || isExportingDoc}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newDocTitle.trim()) {
                          createNewDoc(newDocTitle);
                        }
                      }}
                    />
                    <Button
                      onClick={() => {
                        if (newDocTitle.trim()) {
                          createNewDoc(newDocTitle);
                        }
                      }}
                      className="w-full"
                      variant="secondary"
                      disabled={isImportingDoc || isCreatingDoc || isExportingDoc || !newDocTitle.trim()}
                    >
                      {isCreatingDoc ? "Creating…" : "Create & Export"}
                    </Button>
                  </div>
                </div>

                {/* Import from Doc Section */}
                <div className="space-y-4 rounded-2xl border border-dashed border-border/70 bg-card px-5 py-5">
                  <div className="text-sm text-foreground">
                    <span className="font-medium">Import from existing Doc</span>
                    <p className="mt-1 text-xs text-muted-foreground">Paste a Doc link or ID to import content into canvas.</p>
                  </div>

                  {docImportError && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {docImportError}
                    </div>
                  )}

                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Doc ID or https://docs.google.com/document/d/..."
                      className={sheetModalInputClasses}
                      disabled={isImportingDoc || isCreatingDoc || isExportingDoc}
                      value={docId}
                      onChange={(e) => setDocId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && docId.trim()) {
                          importFromDoc(docId);
                        }
                      }}
                    />

                    <Button
                      onClick={() => {
                        if (docId.trim()) {
                          importFromDoc(docId);
                        }
                      }}
                      className="w-full"
                      variant="secondary"
                      disabled={isImportingDoc || isCreatingDoc || isExportingDoc || !docId.trim()}
                    >
                      {isImportingDoc ? "Importing…" : "Import to Canvas"}
                    </Button>
                  </div>
                </div>

                {/* Export to Existing Doc Section */}
                <div className="space-y-4 rounded-2xl border border-dashed border-border/70 bg-card px-5 py-5">
                  <div className="text-sm text-foreground">
                    <span className="font-medium">Export to existing Doc</span>
                    <p className="mt-1 text-xs text-muted-foreground">Paste a Doc link or ID to export current canvas content.</p>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Doc ID or https://docs.google.com/document/d/..."
                      className={sheetModalInputClasses}
                      disabled={isImportingDoc || isCreatingDoc || isExportingDoc}
                      value={exportDocId}
                      onChange={(e) => setExportDocId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && exportDocId.trim()) {
                          exportToDoc(exportDocId);
                        }
                      }}
                    />

                    <Button
                      onClick={() => {
                        if (exportDocId.trim()) {
                          exportToDoc(exportDocId);
                        }
                      }}
                      className="w-full"
                      variant="secondary"
                      disabled={isImportingDoc || isCreatingDoc || isExportingDoc || !exportDocId.trim()}
                    >
                      {isExportingDoc ? "Exporting…" : "Export to Doc"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted px-5 py-4 text-xs text-muted-foreground">
                  <p><span className="font-medium text-foreground">Heads up:</span> New Docs open in a new tab. Ensure Composio has access to your documents.</p>
                  <p className="mt-2">We intelligently parse document content and structure into canvas documents.</p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    variant="outline"
                    className="sm:w-fit"
                    onClick={() => {
                      if (!isImportingDoc && !isCreatingDoc && !isExportingDoc) {
                        setShowDocModal(false);
                        setDocImportError("");
                        setNewDocTitle("");
                        setDocId("");
                        setExportDocId("");
                      }
                    }}
                    disabled={isImportingDoc || isCreatingDoc || isExportingDoc}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
