import { pdfjsLib } from "./pdfjs";

export async function renderPdfPages(
  bytes: Uint8Array,
  scale: number,
  onPage: (pageIndex: number, dataUrl: string) => void
): Promise<void> {
  // pdfjs may detach/transfer the buffer, so hand it a copy.
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context を取得できませんでした");
    }

    await page.render({ canvasContext: context, viewport }).promise;
    onPage(pageNumber - 1, canvas.toDataURL("image/png"));
    page.cleanup();
  }

  await pdf.destroy();
}
