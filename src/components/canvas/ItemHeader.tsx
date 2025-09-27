"use client";

import type React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DocumentData } from "@/lib/canvas/types";

export function ItemHeader(props: {
  id: string;
  name: string;
  data?: DocumentData;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  onSave?: () => void;
  onRemove?: () => void;
}) {
  const { id, name, data, isExpanded = true, onToggleExpanded, onSave, onRemove } = props;
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          {data?.googleDocsId ? (
            <a
              href={`https://docs.google.com/document/d/${data.googleDocsId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm border border-dashed border-foreground/25 px-1 py-0.5 text-xs font-mono text-muted-foreground/50 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <span className="font-medium">ID:</span><span className="-tracking-widest"> </span><span className="tracking-wide">{data.googleDocsId}</span>
            </a>
          ) : (
            <span className="rounded-sm border border-dashed border-foreground/25 px-1 py-0.5 text-xs font-mono text-muted-foreground/50">
              <span className="font-medium">ID:</span><span className="-tracking-widest"> </span><span className="tracking-wide">{id}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onSave && (
            <button
              onClick={onSave}
              className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              {data?.googleDocsId ? 'Update' : 'Save'}
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="px-2 py-1 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <button
        onClick={onToggleExpanded}
        className="flex w-full items-center gap-2 text-left text-2xl font-semibold text-foreground hover:text-accent transition-colors group cursor-pointer"
      >
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" />
        )}
        <span className="flex-1">{name || "Untitled Document"}</span>
      </button>
    </div>
  );
}

export default ItemHeader;


