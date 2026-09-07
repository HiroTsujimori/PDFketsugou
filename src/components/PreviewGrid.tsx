import { useEffect, useRef, useState } from "react";
import type { PdfFileItem } from "../types";
import { formatBytes } from "../lib/format";

interface PreviewGridProps {
  files: PdfFileItem[];
  onReorder: (sourceId: string, targetId: string, placeAfter: boolean) => void;
  onRemove: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, fileId: string) => void;
  onOpenPreview: (fileId: string) => void;
}

interface DragInfo {
  id: string;
  offsetX: number;
  offsetY: number;
}

export default function PreviewGrid({
  files,
  onReorder,
  onRemove,
  onContextMenu,
  onOpenPreview,
}: PreviewGridProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const [ghostSize, setGhostSize] = useState({ width: 0, height: 0 });
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragInfoRef = useRef<DragInfo | null>(null);
  const lastTargetRef = useRef<{ targetId: string; after: boolean } | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    const card = cardRefs.current.get(id);
    if (!card) return;
    const rect = card.getBoundingClientRect();
    dragInfoRef.current = {
      id,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    lastTargetRef.current = null;
    setGhostSize({ width: rect.width, height: rect.height });
    setGhostPos({ x: rect.left, y: rect.top });
    setDraggingId(id);
  };

  useEffect(() => {
    if (!draggingId) return;

    const handleMove = (e: PointerEvent) => {
      const info = dragInfoRef.current;
      if (!info) return;
      setGhostPos({ x: e.clientX - info.offsetX, y: e.clientY - info.offsetY });

      // Walk the cards in reading order (matches the flex-wrap layout: left
      // to right, wrapping to the next row) and find the first one the
      // pointer is still "before" - either because it's above that card's
      // row, or in the same row but left of its center. Falling through the
      // whole list means the pointer is past everything, so append at the
      // end. This also correctly handles dropping into the empty space to
      // the right of a short last row, which pure nearest-center distance
      // could misattribute to a card in the row above.
      const rects = filesRef.current
        .filter((f) => f.id !== info.id)
        .map((f) => {
          const el = cardRefs.current.get(f.id);
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            id: f.id,
            top: rect.top,
            bottom: rect.bottom,
            centerX: rect.left + rect.width / 2,
          };
        })
        .filter((r): r is { id: string; top: number; bottom: number; centerX: number } => r !== null);

      let targetId: string | null = null;
      let placeAfter = false;

      for (const r of rects) {
        const aboveRow = e.clientY < r.top;
        const sameRow = e.clientY >= r.top && e.clientY <= r.bottom;
        if (aboveRow || (sameRow && e.clientX < r.centerX)) {
          targetId = r.id;
          placeAfter = false;
          break;
        }
      }

      if (!targetId && rects.length > 0) {
        targetId = rects[rects.length - 1].id;
        placeAfter = true;
      }

      if (targetId) {
        const last = lastTargetRef.current;
        if (!last || last.targetId !== targetId || last.after !== placeAfter) {
          lastTargetRef.current = { targetId, after: placeAfter };
          onReorder(info.id, targetId, placeAfter);
        }
      }
    };

    const handleUp = () => {
      setDraggingId(null);
      dragInfoRef.current = null;
      lastTargetRef.current = null;
    };

    document.body.classList.add("dragging-card");
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      document.body.classList.remove("dragging-card");
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggingId, onReorder]);

  if (files.length === 0) {
    return (
      <div className="preview-grid empty">
        <p>PDFまたはZIPファイルをここにドラッグ&ドロップしてください</p>
      </div>
    );
  }

  const draggingFile = draggingId ? files.find((f) => f.id === draggingId) : null;

  return (
    <div className="preview-grid">
      {files.map((file, index) => (
        <div
          key={file.id}
          ref={(el) => {
            if (el) cardRefs.current.set(file.id, el);
            else cardRefs.current.delete(file.id);
          }}
          onPointerDown={(e) => handlePointerDown(e, file.id)}
          onDoubleClick={() => onOpenPreview(file.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu(e, file.id);
          }}
          className={"preview-card" + (draggingId === file.id ? " dragging" : "")}
          title={file.name}
        >
          <div className="preview-card-thumb-wrap">
            <span className="preview-card-index">{index + 1}</span>
            <button
              className="preview-card-remove"
              title="削除"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onRemove(file.id)}
            >
              ×
            </button>
            {file.pages[0] && (
              <img
                src={file.pages[0].thumbnail}
                alt={file.name}
                className="preview-card-thumb"
                draggable={false}
              />
            )}
            <div className="preview-card-tooltip">
              {formatBytes(file.bytes.length)} - {file.pageCount} ページ
              <br />
              ダブルクリックでプレビュー
            </div>
          </div>
          <div className="preview-card-name">{file.name}</div>
        </div>
      ))}

      {draggingId && draggingFile && draggingFile.pages[0] && (
        <div
          className="preview-card-ghost"
          style={{
            left: ghostPos.x,
            top: ghostPos.y,
            width: ghostSize.width,
            height: ghostSize.height,
          }}
        >
          <img
            src={draggingFile.pages[0].thumbnail}
            alt={draggingFile.name}
            className="preview-card-thumb"
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}
