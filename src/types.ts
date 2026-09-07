export interface PdfPage {
  pageIndex: number;
  thumbnail: string;
}

export interface PdfFileItem {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  pages: PdfPage[];
}
