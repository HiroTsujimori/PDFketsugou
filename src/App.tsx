import { useCallback, useEffect, useRef, useState } from "react";
import FileList from "./components/FileList";
import PreviewGrid from "./components/PreviewGrid";
import PdfDetailView from "./components/PdfDetailView";
import ContextMenu from "./components/ContextMenu";
import type { ContextMenuState } from "./components/ContextMenu";
import { extractPdfsFromFiles } from "./lib/extractPdfs";
import { renderPdfThumbnails } from "./lib/thumbnails";
import { mergePdfs, downloadMergedPdf } from "./lib/merge";
import type { PdfFileItem } from "./types";
import "./App.css";

function makeId() {
  return crypto.randomUUID();
}

const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 640;
const DEFAULT_SIDEBAR_WIDTH = 300;
const SIDEBAR_WIDTH_STORAGE_KEY = "pdf-merge-app:sidebar-width";

function loadStoredSidebarWidth(): number {
  const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
  if (Number.isFinite(stored) && stored >= MIN_SIDEBAR_WIDTH && stored <= MAX_SIDEBAR_WIDTH) {
    return stored;
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

export default function App() {
  const [files, setFiles] = useState<PdfFileItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(loadStoredSidebarWidth);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    if (previewFileId && !files.some((f) => f.id === previewFileId)) {
      setPreviewFileId(null);
    }
  }, [files, previewFileId]);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handleMouseMove = (e: MouseEvent) => {
      const widthFromCursor = window.innerWidth - e.clientX;
      const clamped = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, widthFromCursor)
      );
      setSidebarWidth(clamped);
    };
    const handleMouseUp = () => setIsResizingSidebar(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  const addFiles = useCallback(async (fileList: File[]) => {
    setError(null);
    setIsProcessing(true);
    try {
      const rawPdfs = await extractPdfsFromFiles(fileList);
      if (rawPdfs.length === 0) {
        setError("PDFファイルが見つかりませんでした（ZIP内も含む）。");
        return;
      }

      for (const raw of rawPdfs) {
        try {
          const { pageCount, thumbnails } = await renderPdfThumbnails(raw.bytes);
          const item: PdfFileItem = {
            id: makeId(),
            name: raw.name,
            bytes: raw.bytes,
            pageCount,
            pages: thumbnails.map((thumbnail, pageIndex) => ({
              pageIndex,
              thumbnail,
            })),
          };
          setFiles((prev) => [...prev, item]);
        } catch (err) {
          console.error(err);
          setError((prev) =>
            prev
              ? `${prev} / ${raw.name} の読み込みに失敗しました`
              : `${raw.name} の読み込みに失敗しました（破損しているか非対応の形式です）`
          );
        }
      }
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCounter.current += 1;
    setIsDraggingOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) addFiles(dropped);
  };

  const handleFilePicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const reorder = useCallback(
    (sourceId: string, targetId: string, placeAfter: boolean) => {
      if (sourceId === targetId) return;
      setFiles((prev) => {
        const sourceIndex = prev.findIndex((f) => f.id === sourceId);
        if (sourceIndex === -1) return prev;
        const updated = [...prev];
        const [moved] = updated.splice(sourceIndex, 1);
        let insertIndex = updated.findIndex((f) => f.id === targetId);
        if (insertIndex === -1) return prev;
        if (placeAfter) insertIndex += 1;
        updated.splice(insertIndex, 0, moved);
        return updated;
      });
    },
    []
  );

  const moveToTop = useCallback((id: string) => {
    setFiles((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index <= 0) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(index, 1);
      updated.unshift(moved);
      return updated;
    });
  }, []);

  const moveToBottom = useCallback((id: string) => {
    setFiles((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index === -1 || index === prev.length - 1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(index, 1);
      updated.push(moved);
      return updated;
    });
  }, []);

  const moveUp = useCallback((id: string) => {
    setFiles((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index <= 0) return prev;
      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
  }, []);

  const moveDown = useCallback((id: string) => {
    setFiles((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index === -1 || index === prev.length - 1) return prev;
      const updated = [...prev];
      [updated[index + 1], updated[index]] = [updated[index], updated[index + 1]];
      return updated;
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  const openPreview = useCallback((id: string) => {
    setPreviewFileId(id);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewFileId(null);
  }, []);

  const previewFile = previewFileId
    ? files.find((f) => f.id === previewFileId) ?? null
    : null;

  const handleMerge = async () => {
    if (files.length === 0) return;
    setError(null);
    setIsMerging(true);
    try {
      const merged = await mergePdfs(files);
      downloadMergedPdf(merged, "○○病院点検報告書.pdf");
    } catch (err) {
      console.error(err);
      setError("PDFの結合に失敗しました。");
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div
      className={"app" + (isResizingSidebar ? " resizing" : "")}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="app-header">
        <h1>PDF結合アプリ</h1>
        <div className="header-actions">
          <label className="file-picker-btn">
            ファイルを選択
            <input
              type="file"
              accept=".pdf,.zip,application/pdf,application/zip"
              multiple
              onChange={handleFilePicker}
              hidden
            />
          </label>
          <button
            onClick={clearAll}
            disabled={files.length === 0}
            className="secondary-btn"
          >
            全てクリア
          </button>
          <button
            onClick={handleMerge}
            disabled={files.length === 0 || isMerging}
            className="primary-btn"
          >
            {isMerging ? "結合中..." : `結合してダウンロード（${files.length}件）`}
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {isProcessing && <div className="info-banner">PDFを読み込み中...</div>}

      <div className="app-body">
        <div className="preview-area">
          <PreviewGrid
            files={files}
            onReorder={reorder}
            onRemove={removeFile}
            onContextMenu={(e, fileId) =>
              setContextMenu({ x: e.clientX, y: e.clientY, fileId })
            }
            onOpenPreview={openPreview}
          />
          {previewFile && (
            <PdfDetailView file={previewFile} onClose={closePreview} />
          )}
        </div>
        <div
          className="sidebar-resizer"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizingSidebar(true);
          }}
        />
        <aside className="sidebar" style={{ width: sidebarWidth }}>
          <h2>ファイル一覧</h2>
          <FileList files={files} onReorder={reorder} onRemove={removeFile} />
        </aside>
      </div>

      {isDraggingOver && (
        <div className="drop-overlay">
          <p>ここにPDF / ZIPファイルをドロップ</p>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          onMoveToTop={moveToTop}
          onMoveToBottom={moveToBottom}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
          onRemove={removeFile}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
