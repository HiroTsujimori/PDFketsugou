import { useEffect, useRef } from "react";

export interface ContextMenuState {
  x: number;
  y: number;
  fileId: string;
}

interface ContextMenuProps {
  state: ContextMenuState;
  onMoveToTop: (fileId: string) => void;
  onMoveToBottom: (fileId: string) => void;
  onMoveUp: (fileId: string) => void;
  onMoveDown: (fileId: string) => void;
  onRemove: (fileId: string) => void;
  onClose: () => void;
}

export default function ContextMenu({
  state,
  onMoveToTop,
  onMoveToBottom,
  onMoveUp,
  onMoveDown,
  onRemove,
  onClose,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const run = (fn: (fileId: string) => void) => {
    fn(state.fileId);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ top: state.y, left: state.x }}
    >
      <button onClick={() => run(onMoveUp)}>↑ 1つ上へ移動</button>
      <button onClick={() => run(onMoveDown)}>↓ 1つ下へ移動</button>
      <button onClick={() => run(onMoveToTop)}>⤒ 先頭へ移動</button>
      <button onClick={() => run(onMoveToBottom)}>⤓ 末尾へ移動</button>
      <div className="context-menu-divider" />
      <button className="danger" onClick={() => run(onRemove)}>
        ✕ このPDFを削除
      </button>
    </div>
  );
}
