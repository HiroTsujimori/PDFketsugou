import { useState } from "react";
import type { PdfFileItem } from "../types";

const DND_MIME = "application/x-pdf-item";

interface FileListProps {
  files: PdfFileItem[];
  onReorder: (sourceId: string, targetId: string, placeAfter: boolean) => void;
  onRemove: (id: string) => void;
}

export default function FileList({ files, onReorder, onRemove }: FileListProps) {
  const [dragOver, setDragOver] = useState<{ id: string; after: boolean } | null>(
    null
  );

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData(DND_MIME, id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    if (!e.dataTransfer.types.includes(DND_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY - rect.top > rect.height / 2;
    setDragOver({ id, after });
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    if (!e.dataTransfer.types.includes(DND_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData(DND_MIME);
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY - rect.top > rect.height / 2;
    if (sourceId) onReorder(sourceId, targetId, after);
    setDragOver(null);
  };

  if (files.length === 0) {
    return (
      <div className="file-list empty">
        <p>PDFファイルがまだありません</p>
      </div>
    );
  }

  return (
    <ul className="file-list">
      {files.map((file, index) => (
        <li
          key={file.id}
          draggable
          onDragStart={(e) => handleDragStart(e, file.id)}
          onDragOver={(e) => handleDragOver(e, file.id)}
          onDragLeave={() => setDragOver((prev) => (prev?.id === file.id ? null : prev))}
          onDrop={(e) => handleDrop(e, file.id)}
          onDragEnd={() => setDragOver(null)}
          className={
            "file-list-item" +
            (dragOver?.id === file.id ? (dragOver.after ? " drop-after" : " drop-before") : "")
          }
        >
          <span className="file-index">{index + 1}</span>
          <span className="file-name" title={file.name}>
            {file.name}
          </span>
          <span className="file-pages">{file.pageCount}p</span>
          <button
            className="remove-btn"
            title="削除"
            onClick={() => onRemove(file.id)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
