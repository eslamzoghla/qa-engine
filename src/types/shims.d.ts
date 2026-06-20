declare module "bidi-js" {
  // Minimal surface used by src/lib/pdf/arabic.ts. The library has no types.
  interface BidiInstance {
    getEmbeddingLevels(text: string, baseDirection?: "ltr" | "rtl" | "auto"): unknown;
    getReorderedString(text: string, embeddingLevels: unknown): string;
  }
  const factory: () => BidiInstance;
  export default factory;
}

declare module "arabic-persian-reshaper" {
  export const ArabicShaper: { convertArabic(input: string): string };
  export const PersianShaper: { convertArabic(input: string): string };
}
