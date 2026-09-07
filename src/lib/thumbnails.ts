import { pdfjsLib } from "./pdfjs";

const THUMBNAIL_SCALE = 0.35;

export async function renderPdfThumbnails(
  bytes: Uint8Array
): Promise<{ pageCount: number; thumbnails: string[] }> {
  // pdfjs may detach/transfer the buffer, so hand it a copy.
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;
  const thumbnails: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context を取得できませんでした");
    }

    await page.render({ canvasContext: context, viewport }).promise;
    thumbnails.push(canvas.toDataURL("image/png"));
    page.cleanup();
  }

  await pdf.destroy();

  return { pageCount: pdf.numPages, thumbnails };
}
