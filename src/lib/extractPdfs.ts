import JSZip from "jszip";

export interface RawPdf {
  name: string;
  bytes: Uint8Array;
}

function isPdfName(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

function isZipName(name: string): boolean {
  return name.toLowerCase().endsWith(".zip");
}

// Zip entries created by Windows Explorer ("send to > compressed folder")
// on a Japanese system store file names in Shift-JIS without setting the
// UTF-8 flag, so JSZip's default UTF-8 decoding mojibakes them. Only entries
// without the UTF-8 flag reach this callback, so prefer Shift-JIS and fall
// back to UTF-8 for entries that aren't valid Shift-JIS.
function decodeZipEntryName(bytes: Uint8Array | number[] | string[]): string {
  const byteArray =
    bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes as number[]);
  try {
    return new TextDecoder("shift_jis", { fatal: true }).decode(byteArray);
  } catch {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(byteArray);
    } catch {
      return new TextDecoder("utf-8").decode(byteArray);
    }
  }
}

async function extractPdfsFromZip(file: File): Promise<RawPdf[]> {
  const zip = await JSZip.loadAsync(file, {
    decodeFileName: decodeZipEntryName,
  });
  const results: RawPdf[] = [];

  const entries = Object.values(zip.files).filter(
    (entry) => !entry.dir && isPdfName(entry.name)
  );

  for (const entry of entries) {
    const bytes = await entry.async("uint8array");
    // entry.name may include the folder path inside the zip; keep just the
    // filename but disambiguate with the containing folder if present.
    const parts = entry.name.split("/").filter(Boolean);
    const displayName = parts.length > 1 ? parts.join(" / ") : parts[0];
    results.push({ name: displayName, bytes });
  }

  return results;
}

export async function extractPdfsFromFiles(files: File[]): Promise<RawPdf[]> {
  const results: RawPdf[] = [];

  for (const file of files) {
    if (isPdfName(file.name)) {
      const buffer = await file.arrayBuffer();
      results.push({ name: file.name, bytes: new Uint8Array(buffer) });
    } else if (isZipName(file.name)) {
      const pdfsInZip = await extractPdfsFromZip(file);
      results.push(...pdfsInZip);
    }
  }

  return results;
}
