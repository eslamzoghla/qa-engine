// Arabic / RTL shaping helpers for PDF output.
//
// jsPDF's built-in Latin font (Helvetica) has no Arabic glyphs and no
// bidirectional reordering — Arabic logical text renders either as mojibake
// or as disconnected isolated letters. To produce a readable PDF we must:
//   1. Convert each logical Arabic character to its correct presentation form
//      (isolated / initial / medial / final) — handled by arabic-persian-reshaper.
//   2. Reorder the logical character stream into visual order so the PDF
//      renderer (which draws strictly left-to-right) shows it right-to-left —
//      handled by bidi-js.
//
// The result must be drawn LTR by jsPDF (no R2L flag) because we already
// produced visually-ordered text.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reshaper: { ArabicShaper: { convertArabic: (s: string) => string } } =
  // @ts-expect-error untyped CJS module
  await import("arabic-persian-reshaper");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bidiFactory: any = (await import("bidi-js")).default;
const bidi = bidiFactory();

// Hebrew + Arabic + Arabic Supplement + Arabic Extended + Arabic Presentation Forms
const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

export function containsRTL(text: string): boolean {
  return !!text && RTL_RE.test(text);
}

/**
 * Reshape + bidi-reorder a string for jsPDF rendering.
 * Pure LTR strings are returned unchanged for performance.
 */
export function shapeForPdf(text: string | undefined | null): string {
  if (text === undefined || text === null) return "";
  const s = String(text);
  if (!containsRTL(s)) return s;
  try {
    const reshaped = reshaper.ArabicShaper.convertArabic(s);
    const levels = bidi.getEmbeddingLevels(reshaped, "rtl");
    return bidi.getReorderedString(reshaped, levels);
  } catch {
    return s;
  }
}

/** True if a cell is dominantly RTL — used to right-align table cells. */
export function isRTLDominant(text: string): boolean {
  if (!text) return false;
  let rtl = 0, ltr = 0;
  for (const ch of text) {
    if (RTL_RE.test(ch)) rtl++;
    else if (/[A-Za-z]/.test(ch)) ltr++;
  }
  return rtl > ltr;
}
