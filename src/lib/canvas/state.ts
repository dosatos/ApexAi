import { AgentState, DocumentData, ItemData } from "@/lib/canvas/types";

export const initialState: AgentState = {
  items: [],
  globalTitle: "",
  globalDescription: "",
  lastAction: "",
  itemsCreated: 0,
  syncSheetId: "",
};

export function isNonEmptyAgentState(value: unknown): value is AgentState {
  if (value == null || typeof value !== "object") return false;
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length > 0;
}

export function defaultDataFor(): ItemData {
  const now = new Date().toISOString();
  return {
    content: "",
    createdAt: now,
    modifiedAt: now,
    wordCount: 0,
  } as DocumentData;
}




