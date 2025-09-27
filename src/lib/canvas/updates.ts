import { DocumentData } from "@/lib/canvas/types";

export function updateDocumentContent(data: DocumentData, content: string): DocumentData {
  const now = new Date().toISOString();
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return {
    ...data,
    content,
    modifiedAt: now,
    wordCount,
    createdAt: data.createdAt || now,
  };
}




