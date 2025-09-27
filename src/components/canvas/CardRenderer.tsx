"use client";

import { FileText } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import type { DocumentData, Item, ItemData } from "@/lib/canvas/types";

export function CardRenderer(props: {
  item: Item;
  onUpdateData: (updater: (prev: ItemData) => ItemData) => void;
  onToggleTag?: (tag: string) => void;
}) {
  const { item, onUpdateData } = props;
  const documentData = item.data as DocumentData;

  const updateContent = (content: string) => {
    const now = new Date().toISOString();
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

    onUpdateData((prev) => ({
      ...(prev as DocumentData),
      content,
      modifiedAt: now,
      wordCount,
      createdAt: (prev as DocumentData).createdAt || now,
    }));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="mt-4 space-y-4">
      <TextareaAutosize
        value={documentData.content || ""}
        onChange={(e) => updateContent(e.target.value)}
        placeholder="Start writing your document..."
        className="min-h-[300px] w-full resize-none border-0 bg-transparent p-0 text-base leading-7 outline-none placeholder:text-gray-400 focus:ring-0"
        minRows={12}
      />

      <div className="flex items-center justify-between border-t pt-3 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {documentData.wordCount || 0} words
          </span>
          {documentData.createdAt && (
            <span>Created {formatDate(documentData.createdAt)}</span>
          )}
        </div>
        {documentData.modifiedAt && (
          <span>Last edited {formatDate(documentData.modifiedAt)}</span>
        )}
      </div>
    </div>
  );
}

export default CardRenderer;




