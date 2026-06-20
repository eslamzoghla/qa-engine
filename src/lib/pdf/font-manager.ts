// Lazy loader for a Unicode-capable PDF font that supports Arabic.
//
// jsPDF only ships WinAnsi-encoded standard fonts (Helvetica/Times/Courier),
// so Arabic — and any non-Latin codepoint — renders as garbage. The fix is
// to register a real TTF via addFileToVFS + addFont. Noto Naskh Arabic
// Regular covers Arabic + Latin in a single file, so we use it everywhere
// in the PDF once loaded.
//
// The TTF is fetched once on demand from a stable jsDelivr GitHub mirror,
// converted to base64, and cached for the lifetime of the page.

import type jsPDF from "jspdf";

export const PDF_FONT_NAME = "NotoNaskhArabic";

// jsDelivr mirror of googlefonts/noto-fonts — stable, immutable file.
const FONT_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts/hinted/ttf/NotoNaskhArabic/NotoNaskhArabic-Regular.ttf";

let cachedBase64: string | null = null;
let inflight: Promise<string> | null = null;

async function fetchFontBase64(): Promise<string> {
  if (cachedBase64) return cachedBase64;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error(`Font fetch failed: HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < buf.length; i += CHUNK) {
      bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
    }
    cachedBase64 = btoa(bin);
    return cachedBase64;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/**
 * Register the Unicode font on a jsPDF document.
 * Returns true on success, false if the network fetch fails — callers can
 * decide whether to abort the export or fall back to ASCII-only output.
 */
export async function registerPdfFonts(pdf: jsPDF): Promise<boolean> {
  try {
    const b64 = await fetchFontBase64();
    pdf.addFileToVFS(`${PDF_FONT_NAME}-Regular.ttf`, b64);
    pdf.addFont(`${PDF_FONT_NAME}-Regular.ttf`, PDF_FONT_NAME, "normal");
    // Register "bold" style pointing at the same regular file. jsPDF will
    // synthesize a faux-bold weight; this avoids a second 300 KB download
    // and keeps every code path single-font.
    pdf.addFont(`${PDF_FONT_NAME}-Regular.ttf`, PDF_FONT_NAME, "bold");
    pdf.setFont(PDF_FONT_NAME, "normal");
    return true;
  } catch (e) {
    console.warn("[pdf] Unicode font registration failed:", e);
    return false;
  }
}
