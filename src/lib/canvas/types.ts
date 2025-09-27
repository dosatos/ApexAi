export type CardType = "document";

export interface DocumentData {
  content: string; // rich text content
  createdAt?: string; // creation timestamp
  modifiedAt?: string; // last modification timestamp
  wordCount?: number; // word count for the document
  googleDocsId?: string; // Google Docs document ID if synced
  googleDriveId?: string; // Google Drive file ID if imported from Drive
  googleDriveLink?: string; // Google Drive file webViewLink
  googleDriveMimeType?: string; // Google Drive file MIME type
}

export type ItemData = DocumentData;

export interface Item {
  id: string;
  type: CardType;
  name: string; // editable title
  subtitle: string; // subtitle shown under the title
  data: ItemData;
}

export interface AgentState {
  items: Item[];
  globalTitle: string;
  globalDescription: string;
  lastAction?: string;
  itemsCreated: number;
  syncSheetId?: string; // Google Sheet ID for auto-sync
  syncSheetName?: string; // Google Sheet name that was imported from
}




