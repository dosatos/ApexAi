"use client";

import type React from "react";
import type { DocumentData } from "@/lib/canvas/types";

export function ItemHeader(props: {
  id: string;
  name: string;
  data?: DocumentData;
  onNameChange: (value: string) => void;
  onNameCommit?: (value: string) => void;
  onSave?: () => void;
}) {
  const { id, name, data, onNameChange, onNameCommit, onSave } = props;
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
        {onSave && (
          <button
            onClick={onSave}
            className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {data?.googleDocsId ? 'Update' : 'Save'}
          </button>
        )}
      </div>
      <input
        value={name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)}
        onBlur={(e: React.FocusEvent<HTMLInputElement>) => onNameCommit?.(e.target.value)}
        placeholder="Document title"
        className="w-full appearance-none text-2xl font-semibold outline-none placeholder:text-gray-400 transition-colors focus:text-accent focus:placeholder:text-accent/65"
      />
    </div>
  );
}

export default ItemHeader;


