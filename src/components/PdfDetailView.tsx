import { useEffect, useRef, useState } from "react";
import type { PdfFileItem } from "../types";
import { renderPdfPages } from "../lib/renderPage";

const DETAIL_SCALE = 1.4;

interface PdfDetailViewProps {
  file: PdfFileItem;
  onClose: () => void;
}

export default function PdfDetailView({ file, onClose }: PdfDetailViewProps) {
  const [pages, setPages] = useState<string[]>(() =>
    Array(file.pageCount).fill("")
  );
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setPages(Array(file.pageCount).fill(""));

    renderPdfPages(file.bytes, DETAIL_SCALE, (pageIndex, dataUrl) => {
      if (cancelledRef.current) return;
      setPages((prev) => {
        const updated = [...prev];
        updated[pageIndex] = dataUrl;
        return updated;
      });
    }).catch((err) => {
      console.error(err);
    });

    return () => {
      cancelledRef.current = true;
    };
  }, [file.id, file.bytes, file.pageCount]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="pdf-detail-overlay" onClick={onClose}>
      <div className="pdf-detail" onClick={(e) => e.stopPropagation()}>
        <div className="pdf-detail-header">
          <button className="pdf-detail-back" onClick={onClose}>
            ✕ 閉じる
          </button>
          <span className="pdf-detail-title" title={file.name}>
            {file.name}
          </span>
          <span className="pdf-detail-count">{file.pageCount} ページ</span>
        </div>
        <div className="pdf-detail-pages">
          {pages.map((src, index) =>
            src ? (
              <img
                key={index}
                src={src}
                alt={`${file.name} - ${index + 1}ページ`}
                className="pdf-detail-page"
              />
            ) : (
              <div key={index} className="pdf-detail-page pdf-detail-page-loading">
                読み込み中...
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
