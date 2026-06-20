## Goal
Apply the enterprise QA Engine improvements in priority order, preserving all current functionality and UI. Arabic PDF + compliance scoring ship first.

## Phase 1 — Arabic PDF + Structured Export (CRITICAL)
**Issue:** jsPDF's built-in fonts (Helvetica) are WinAnsi-only — Arabic and other non-Latin glyphs render as mojibake (`þÝþíþŸ`). It also has no RTL shaping.

**Fix:**
- Add a Unicode TTF that covers Arabic with shaping (Noto Naskh Arabic) and a Latin companion (Noto Sans). Bundle as base64 via `bun add @fontsource/noto-naskh-arabic @fontsource/noto-sans` and load the TTFs at build time using Vite `?url` / `?arraybuffer` imports, then `doc.addFileToVFS` + `doc.addFont`.
- Add `bidi-js` for logical→visual reordering and `arabic-persian-reshaper` for contextual glyph shaping. Wrap into `src/lib/pdf/arabic.ts` exposing `shapeForPdf(text)` and `containsRTL(text)`.
- New `src/lib/pdf/font-manager.ts`: registers fonts on a jsPDF doc, exposes `setAutoFont(doc, text)` that picks Arabic font + sets `R2L: true` when text contains RTL.
- Rewrite `src/lib/pdf-export.ts` around these helpers — every `doc.text`, every `autoTable` cell goes through `shapeForPdf` and `setAutoFont`. `autoTable` gets a `didParseCell` hook that flips `halign` to `right` for RTL cells.
- Keep existing public API (`generatePdfReport`, `exportReportToCSV/JSON/XLSX`) intact for backward compat.

**Tests:** `src/lib/pdf/__tests__/arabic.test.ts` — verifies reshaper output for known strings and that `containsRTL` detects Arabic ranges; smoke test that `generatePdfReport` produces a non-empty Buffer for a report containing Arabic sheet names.

## Phase 2 — Compliance Score Rebalance (CRITICAL)
**Issue:** Current penalty coefficients (e.g. `extraTableCoefficient: 50`) cause a single structural defect to collapse the score to ~23 while accuracy stays 95%+.

**Fix in `qa-engine.ts`:**
- Move from raw subtraction to a **logarithmic / saturating penalty curve**: `structuralPenalty = 100 * (1 - exp(-Σ(count*coef) / scale))` with `scale` proportional to total cells/sheets. This prevents one defect from zeroing the score.
- Rebalance defaults: structural coefs reduced ~5× (extraTable 10, missingTable 10, missingCol 3, extraCol 3, missingRow 1, extraRow 1); data coefs unchanged.
- Final score blend changed to `0.5 * structural + 0.5 * data` and clamped 1–100 (never 0 unless workbook empty).
- Add `scoreFormula` + `scoreInputs` to `WorkbookReport.totals.compliance` so the report can display the exact formula and substituted values.
- Grade thresholds A≥95, B≥90, C≥80, else D (already in spec).

**Tests:** `src/lib/__tests__/compliance.test.ts` — small workbook with 1 missing column should score ≥80; severely broken workbook should land D.

## Phase 3 — Shift Block Grouping
**Issue:** Adjacent column shifts emit one `ErrorRecord` per column.

**Fix:** Post-process `detectShifts` output in a new `groupAdjacentShifts(errors)` step:
- Sort by sheet, then column index.
- Merge runs where `col[i+1] === col[i]+1` AND same offset/direction into a single `STRUCTURAL_SHIFT_BLOCK` record (`"Columns N:U shifted by +2"`).
- Confidence = weighted mean of member confidences; count = number of merged columns.

## Phase 4 — Performance + Column Matching
- `boundedLevenshtein` already added; extend with **early-out on length-ratio < 0.4** and **bigram pre-filter** (Dice coefficient ≥ 0.3 before falling through to DP).
- `alignRows`: when DP would exceed cap, fall back to anchor-based alignment (hash long unique rows, anchor on them, align between anchors).
- `buildColumnSignature`: stride-sample up to 200 rows across the full dataset (not just head); add token n-gram set, numeric quartiles, null-rate; expose `confidence` per match. Confidence surfaced when `config.debugMode` is on.

## Phase 5 — Numeric Tolerance Validation
- Already converts 5 → 0.05 in PERCENTAGE mode; add a guard: if user enters >100, clamp + toast warning in `ConfigPanel`. Inline helper text already present — extend with worked example.
- Add `src/lib/__tests__/numeric-tolerance.test.ts` covering: abs mode, percent mode (5 means 5%), zero-vs-zero, both-NaN, mixed sign.

## Phase 6 — Executive Dashboard + Per-Sheet Analytics in PDF
First page rewritten with KPI grid (Compliance, Risk, Grade, Sheets, Cells, Critical/Major/Minor). Per-sheet table gains Sheet Score, Risk Level, Status, Error Density columns. Findings table uses `autoTable`'s `cellWidth: 'wrap'` and `overflow: 'linebreak'` so long Arabic strings wrap instead of clipping.

## Phase 7 — Enterprise Extras
- Audit log to `localStorage['qa-history']` (cap 50, FIFO).
- `confidence: number` already on `ErrorRecord`; surface in `ErrorTable` when debug mode is on.
- Export buttons (PDF/XLSX/CSV/JSON) already wired — verify error toasts cover Arabic-font load failures.

## Files Affected
- **New:** `src/lib/pdf/font-manager.ts`, `src/lib/pdf/arabic.ts`, `src/lib/pdf/__tests__/arabic.test.ts`, `src/lib/__tests__/compliance.test.ts`, `src/lib/__tests__/numeric-tolerance.test.ts`, `src/lib/qa-history.ts`
- **Edited:** `src/lib/pdf-export.ts` (full rewrite of layout, keeps exported API), `src/lib/qa-engine.ts` (compliance curve, shift grouping, column-sig sampling, alignment fallback), `src/components/qa/ConfigPanel.tsx` (tolerance clamp + debug toggle), `src/components/qa/Scorecard.tsx` (show formula + per-sheet analytics), `src/components/qa/ErrorTable.tsx` (debug confidence column), `src/routes/index.tsx` (history dropdown), `package.json` / `bun.lock`
- **Deps added:** `@fontsource/noto-naskh-arabic`, `@fontsource/noto-sans`, `bidi-js`, `arabic-persian-reshaper`, `vitest` (if not present) for tests.

## Execution Order
1 → 2 → 3 → 5 → 4 → 6 → 7. After each phase: typecheck via the harness, run vitest, eyeball PDF in preview.

## Out of Scope (will not touch)
- UI layout, colors, fonts of the web app itself.
- Existing route structure, auth, Cloud config.
- Replacing jsPDF (kept; it supports Unicode via VFS fonts — no need for pdfmake/pdf-lib).