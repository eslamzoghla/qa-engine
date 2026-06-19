# Enterprise QA Engine Refactor Plan

This is a large, multi-area refactor. I'll execute it in phased, incremental edits, preserving all existing features and the current UI. Below is the scope, ordering, and the concrete changes per priority.

## Guiding Rules
- No rewrite. Edit `src/lib/qa-engine.ts`, `src/lib/pdf-export.ts`, `src/components/qa/*` in place.
- TypeScript strict, no new `any`.
- Keep existing public types (`WorkbookReport`, `QAConfig`, `ErrorRecord`) backward compatible — only add fields.
- No new heavy native deps; keep bundle Worker-safe.

## Phase 1 — PDF Export (Priority 1 + 7 + partial 9)
**File:** `src/lib/pdf-export.ts` (rewrite internals, keep exported function signature)

- Replace `html2canvas` screenshot approach with **structured `jsPDF` + `jspdf-autotable`** (already common; add `jspdf-autotable` via `bun add`).
- Sections rendered as real text/tables:
  1. Cover (file name, reviewer, employee, date, overall score, grade)
  2. Executive Summary (counts, audit score, structural vs data score)
  3. Compliance & Risk (Compliance Score, Risk Score, Grade A–D)
  4. Structural Defects table
  5. Per-sheet summary table
  6. Top findings (first N high-severity errors) via autoTable, paginated
  7. Recommendations (rule-based from totals)
- Add `onProgress?(step: string)` callback; UI shows loading state + toast on error.
- Export helpers: `exportCSV`, `exportJSON`, `exportXLSX` (xlsx already in deps) — added alongside `exportPDF`.

## Phase 2 — Compliance Engine (Priority 7)
**File:** `src/lib/qa-engine.ts`

Add to `WorkbookReport.totals`:
```ts
compliance: {
  complianceScore: number;  // = finalAuditScore
  riskScore: number;        // 100 - finalAuditScore weighted by critical count
  grade: 'A'|'B'|'C'|'D';
  executiveSummary: string;
  topFindings: ErrorRecord[];
  recommendations: string[];
}
```
Grade thresholds: ≥95 A, ≥90 B, ≥80 C, else D. Recommendations derived from which `byClass` buckets dominate.

## Phase 3 — Column Matching (Priority 2)
**File:** `src/lib/qa-engine.ts` `buildColumnSignature` / `matchColumns`

- Sample up to **200 rows** distributed across the dataset (stride sampling) instead of head-only.
- Signature = {typeHistogram, numericStats: mean/stdev, tokenSet, nullRate, lengthStats}.
- Score = weighted cosine on type histogram + Jaccard on tokens + numeric distribution distance.
- Emit `confidence: 0..1` per matched pair; attach to debug output (`report.debug.columnMatches`).
- ConfigPanel: add a Debug Mode toggle that surfaces `report.debug` in Scorecard.

## Phase 4 — Row Alignment Performance (Priority 3)
**File:** `src/lib/qa-engine.ts` `alignRows`

- Lower hard DP limit from `2_000_000` to **`500_000`** cells.
- Add **banded Needleman–Wunsch** (band width = max(50, 5% of max(n,m))) — O((n+m)·band) memory.
- Fallback for very large sheets: **anchor-based alignment** — hash each row by key columns, find longest common subsequence over anchor hashes via Hunt-Szymanski, fill gaps with positional alignment.
- Guard with `try/catch`; on failure log warning and fall back to positional 1:1 mapping.

## Phase 5 — Similarity Fast-Path (Priority 4)
**File:** `src/lib/qa-engine.ts` `similarity` / `levenshtein`

Fast-paths before Levenshtein:
1. Equal → 1.0
2. One empty → 0
3. `|len(a)-len(b)| / max(len) > 0.5` → return cheap ratio (no DP)
4. Length > 200 → token Jaccard instead of full DP
5. Bounded Levenshtein with early-exit at `maxDistance = ceil(len*0.4)` using two-row banded DP

## Phase 6 — Shift Detection (Priority 5)
**File:** `src/lib/qa-engine.ts` shift detector

- Window from ±3 → **±10** rows / ±5 cols.
- Require ≥70% of cells in the shifted block to match (not just a few) before classifying.
- Emit `confidence` and `shiftSize`. Suppress conflicting per-cell errors only when confidence ≥ 0.8.

## Phase 7 — Numeric Tolerance Validation (Priority 6)
**Files:** `src/lib/qa-engine.ts`, `src/components/qa/ConfigPanel.tsx`

- `compareNumeric`: when `mode==='percent'`, diff = `|a-b| / max(|a|,|b|,ε)`, threshold compared as fraction = `pct/100`. Add inline comment.
- ConfigPanel: clamp 0–100, helper text "5 = 5%", reject negatives.
- Add lightweight self-tests behind `if (import.meta.env.DEV)` console.assert covering: 5% of 100 → 95 passes; 5% of 100 → 94 fails.

## Phase 8 — Architecture Split (Priority 8)
**File:** `src/components/qa/Scorecard.tsx` → split into:
- `Scorecard.tsx` (composition root, unchanged API)
- `panels/AuditScorePanel.tsx`
- `panels/AuditBreakdownPanel.tsx`
- `panels/StructuralPanel.tsx`
- `panels/CompliancePanel.tsx` (new)
- `panels/ExportToolbar.tsx` (PDF/CSV/JSON/XLSX buttons + loading state)

No behavior change; pure file split + new ExportToolbar wired to phase-1 helpers.

## Phase 9 — Enterprise Extras (Priority 9)
- Audit log: append every run to `localStorage['qa-history']` (capped at 50). New `HistoryPanel` (collapsed by default).
- Confidence/risk already covered; ensure `ErrorRecord` exposes `confidence?: number`.

## Out of Scope (will note in closing message)
- Server-side rendering of PDFs (kept client-side per current architecture).
- Backend persistence (no Cloud enable requested).
- New visual design — UI unchanged.

## Dependencies to add
- `jspdf-autotable` (jspdf already present)
- nothing else; `xlsx` already in tree

## Execution Order
1. Phases 5, 6, 7 (small, isolated `qa-engine.ts` changes) — single edit pass.
2. Phases 3, 4 (column matching + alignment) — second edit pass with new helpers.
3. Phase 2 (compliance fields) — additive.
4. Phase 1 (PDF rewrite) + Phase 8 split + ExportToolbar.
5. Phase 9 (history + debug surfacing).
6. Verify build, run targeted Playwright smoke (upload sample, export PDF) if a sample file exists; otherwise rely on build + type check.

Approve to proceed and I'll execute phase-by-phase, returning the exact diffs per file.