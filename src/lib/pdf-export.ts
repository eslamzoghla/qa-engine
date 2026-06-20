// Structured, multi-page PDF report for the QA Engine.
//
// Renders real text + tables via jsPDF + jspdf-autotable. Arabic text is
// reshaped to presentation forms and bidi-reordered before being drawn
// (see src/lib/pdf/arabic.ts). A Unicode-capable TTF (Noto Naskh Arabic) is
// registered on the document at start-up so every glyph — Latin or Arabic —
// renders correctly.

import jsPDF from "jspdf";
import autoTable, {
  type CellHookData,
  type RowInput,
  type UserOptions,
} from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { WorkbookReport, ErrorRecord } from "./qa-engine";
import { containsRTL, isRTLDominant, shapeForPdf } from "./pdf/arabic";
import { PDF_FONT_NAME, registerPdfFonts } from "./pdf/font-manager";

export interface ExportOptions {
  employeeName?: string;
  onProgress?: (step: string) => void;
}

const COLOR_PRIMARY: [number, number, number] = [37, 99, 235];
const COLOR_MUTED: [number, number, number] = [100, 116, 139];
const COLOR_OK: [number, number, number] = [22, 163, 74];
const COLOR_WARN: [number, number, number] = [217, 119, 6];
const COLOR_BAD: [number, number, number] = [220, 38, 38];

function toneColor(score: number): [number, number, number] {
  if (score >= 90) return COLOR_OK;
  if (score >= 70) return COLOR_WARN;
  return COLOR_BAD;
}

const pageWidth = (pdf: jsPDF) => pdf.internal.pageSize.getWidth();
const pageHeight = (pdf: jsPDF) => pdf.internal.pageSize.getHeight();

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > pageHeight(pdf) - 40) {
    pdf.addPage();
    return 50;
  }
  return y;
}

/** Shape one or many strings for PDF rendering. */
const W = (text: string | number | undefined | null): string =>
  shapeForPdf(text === undefined || text === null ? "" : String(text));

function setFont(pdf: jsPDF, style: "normal" | "bold" = "normal", size?: number) {
  pdf.setFont(PDF_FONT_NAME, style);
  if (size !== undefined) pdf.setFontSize(size);
}

function sectionHeader(pdf: jsPDF, y: number, title: string): number {
  y = ensureSpace(pdf, y, 30);
  setFont(pdf, "bold", 13);
  pdf.setTextColor(...COLOR_PRIMARY);
  pdf.text(W(title), 40, y);
  pdf.setDrawColor(...COLOR_PRIMARY);
  pdf.setLineWidth(0.6);
  pdf.line(40, y + 4, pageWidth(pdf) - 40, y + 4);
  pdf.setTextColor(0, 0, 0);
  return y + 18;
}

function paragraph(
  pdf: jsPDF,
  y: number,
  text: string,
  opts?: { size?: number; muted?: boolean },
): number {
  setFont(pdf, "normal", opts?.size ?? 10);
  if (opts?.muted) pdf.setTextColor(...COLOR_MUTED);
  else pdf.setTextColor(0, 0, 0);
  const rtl = isRTLDominant(text);
  const shaped = W(text);
  const lines = pdf.splitTextToSize(shaped, pageWidth(pdf) - 80) as string[];
  const rightX = pageWidth(pdf) - 40;
  for (const line of lines) {
    y = ensureSpace(pdf, y, 14);
    if (rtl) pdf.text(line, rightX, y, { align: "right" });
    else pdf.text(line, 40, y);
    y += 14;
  }
  pdf.setTextColor(0, 0, 0);
  return y + 4;
}

/** Shape every cell value and right-align RTL cells. */
function shapeBody(body: (string | number)[][]): RowInput[] {
  return body.map((row) => row.map((c) => W(c)));
}

function autoTableOpts(extra?: Partial<UserOptions>): Partial<UserOptions> {
  return {
    margin: { left: 40, right: 40 },
    styles: {
      font: PDF_FONT_NAME,
      fontStyle: "normal",
      fontSize: 9,
      cellPadding: 4,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      font: PDF_FONT_NAME,
      fillColor: COLOR_PRIMARY,
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data: CellHookData) => {
      const text = Array.isArray(data.cell.text)
        ? data.cell.text.join(" ")
        : String(data.cell.text ?? "");
      if (isRTLDominant(text)) data.cell.styles.halign = "right";
    },
    ...extra,
  };
}

function table(
  pdf: jsPDF,
  y: number,
  head: string[][],
  body: (string | number)[][],
  opts?: Partial<UserOptions>,
): number {
  const shapedHead = head.map((r) => r.map((c) => W(c)));
  autoTable(pdf, {
    startY: y,
    head: shapedHead,
    body: shapeBody(body),
    ...autoTableOpts(opts),
  });
  type WithLast = jsPDF & { lastAutoTable?: { finalY: number } };
  return ((pdf as WithLast).lastAutoTable?.finalY ?? y) + 14;
}

function footer(pdf: jsPDF) {
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    setFont(pdf, "normal", 8);
    pdf.setTextColor(...COLOR_MUTED);
    pdf.text(
      W(`QA Engine · generated ${new Date().toLocaleString()}`),
      40,
      pageHeight(pdf) - 20,
    );
    pdf.text(W(`Page ${i} / ${total}`), pageWidth(pdf) - 80, pageHeight(pdf) - 20);
  }
  pdf.setTextColor(0, 0, 0);
}

// ---------- KPI card grid (executive cover) ----------
function kpiCard(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  sub?: string,
  tone?: [number, number, number],
) {
  pdf.setDrawColor(220, 224, 232);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(x, y, w, h, 4, 4, "FD");
  setFont(pdf, "bold", 8);
  pdf.setTextColor(...COLOR_MUTED);
  pdf.text(W(label), x + 10, y + 16);
  setFont(pdf, "bold", 20);
  pdf.setTextColor(...(tone ?? [15, 23, 42]));
  pdf.text(W(value), x + 10, y + 40);
  if (sub) {
    setFont(pdf, "normal", 8);
    pdf.setTextColor(...COLOR_MUTED);
    pdf.text(W(sub), x + 10, y + 56);
  }
  pdf.setTextColor(0, 0, 0);
}

// ---------- Per-sheet analytics ----------
interface SheetAnalytics {
  name: string;
  rows: number;
  cols: number;
  compared: number;
  errors: number;
  critical: number;
  density: number; // errors per 1000 compared cells
  score: number; // 0–100
  risk: "LOW" | "MEDIUM" | "HIGH";
  status: "PASS" | "WARN" | "FAIL";
}

function sheetAnalytics(report: WorkbookReport): SheetAnalytics[] {
  return report.sheets.map((s) => {
    const errors = s.errors.length;
    const critical = s.errors.filter((e) => e.severity === "CRITICAL").length;
    const score = s.comparedCells
      ? Math.max(0, ((s.comparedCells - errors) / s.comparedCells) * 100)
      : 100;
    const density = s.comparedCells ? (errors / s.comparedCells) * 1000 : 0;
    const risk: SheetAnalytics["risk"] =
      score >= 95 && critical === 0 ? "LOW" : score >= 80 ? "MEDIUM" : "HIGH";
    const status: SheetAnalytics["status"] =
      score >= 95 ? "PASS" : score >= 80 ? "WARN" : "FAIL";
    return {
      name: s.name,
      rows: s.rowCount,
      cols: s.colCount,
      compared: s.comparedCells,
      errors,
      critical,
      density,
      score,
      risk,
      status,
    };
  });
}

// ============================================================
//  Main entry point
// ============================================================
export async function exportReportToPDF(
  report: WorkbookReport,
  filename: string,
  opts: ExportOptions = {},
): Promise<void> {
  const { onProgress } = opts;

  onProgress?.("Loading Unicode font (Arabic support)…");
  const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const fontReady = await registerPdfFonts(pdf);
  if (!fontReady) {
    // Continue, but warn — Arabic glyphs will be missing.
    onProgress?.("⚠ Font load failed — Arabic text may not render");
  }
  setFont(pdf, "normal", 10);

  const t = report.totals;
  const c = t.compliance;
  const sev = t.bySeverity;
  const sheetStats = sheetAnalytics(report);

  // ---------- Cover ----------
  onProgress?.("Rendering cover page");
  setFont(pdf, "bold", 22);
  pdf.setTextColor(...COLOR_PRIMARY);
  pdf.text(W("QA Audit Report"), 40, 70);

  setFont(pdf, "normal", 10);
  pdf.setTextColor(...COLOR_MUTED);
  pdf.text(W(`Generated ${new Date().toLocaleString()}`), 40, 88);
  if (opts.employeeName) {
    pdf.text(W(`Employee: ${opts.employeeName}`), 40, 102);
  }
  pdf.setTextColor(0, 0, 0);

  // KPI grid — 4 columns × 2 rows
  const gridY = 120;
  const gutter = 10;
  const cardW = (pageWidth(pdf) - 80 - gutter * 3) / 4;
  const cardH = 70;
  kpiCard(pdf, 40, gridY, cardW, cardH,
    "COMPLIANCE", c.complianceScore.toFixed(1), c.gradeLabel, toneColor(c.complianceScore));
  kpiCard(pdf, 40 + (cardW + gutter), gridY, cardW, cardH,
    "RISK SCORE", c.riskScore.toFixed(1),
    c.riskScore < 10 ? "Low exposure" : c.riskScore < 30 ? "Moderate" : "Elevated",
    toneColor(100 - c.riskScore));
  kpiCard(pdf, 40 + (cardW + gutter) * 2, gridY, cardW, cardH,
    "GRADE", c.grade, c.gradeLabel, toneColor(c.complianceScore));
  kpiCard(pdf, 40 + (cardW + gutter) * 3, gridY, cardW, cardH,
    "ACCURACY", `${t.baseAccuracy.toFixed(1)}%`, "Cell match rate");

  const gridY2 = gridY + cardH + gutter;
  kpiCard(pdf, 40, gridY2, cardW, cardH,
    "SHEETS", String(report.sheets.length), `${report.excludedSheets.length} excluded`);
  kpiCard(pdf, 40 + (cardW + gutter), gridY2, cardW, cardH,
    "CELLS COMPARED", t.comparedCells.toLocaleString());
  kpiCard(pdf, 40 + (cardW + gutter) * 2, gridY2, cardW, cardH,
    "CRITICAL", String(sev.CRITICAL), "structural defects",
    sev.CRITICAL ? COLOR_BAD : COLOR_OK);
  kpiCard(pdf, 40 + (cardW + gutter) * 3, gridY2, cardW, cardH,
    "MAJOR / MINOR", `${sev.HIGH} / ${sev.MEDIUM + sev.LOW}`, "high / med+low");

  let y = gridY2 + cardH + 24;

  // File metadata
  y = table(
    pdf, y,
    [["Field", "Value"]],
    [
      ["Reviewer file", report.metadata.fileBName],
      ["Employee file", report.metadata.fileAName],
      ["Strict mode", report.strictMode ? "ON" : "OFF"],
      ["Total errors", String(t.totalErrors)],
      ["Total penalty", t.totalPenalty.toFixed(2)],
    ],
  );

  // ---------- Executive Summary ----------
  onProgress?.("Writing executive summary");
  y = sectionHeader(pdf, y, "Executive Summary");
  y = paragraph(pdf, y, c.executiveSummary);

  // ---------- Score Transparency ----------
  y = sectionHeader(pdf, y, "Score Calculation");
  y = paragraph(pdf, y, c.scoreFormula, { muted: true, size: 9 });
  y = table(
    pdf, y,
    [["Component", "Value"]],
    [
      ["Structural Penalty", c.scoreInputs.structuralPenalty.toFixed(2)],
      ["Data Penalty", c.scoreInputs.dataPenalty.toFixed(2)],
      ["Saturation Scale", c.scoreInputs.scale.toFixed(2)],
      ["Structural Score", t.structuralScore.toFixed(2)],
      ["Data Score", t.dataScore.toFixed(2)],
      ["Final Audit Score", t.finalAuditScore.toFixed(2)],
      ["Base Accuracy %", t.baseAccuracy.toFixed(2)],
      ["Weighted Accuracy %", t.weightedAccuracy.toFixed(2)],
    ],
  );

  // ---------- Audit Breakdown ----------
  onProgress?.("Writing audit breakdown");
  y = sectionHeader(pdf, y, "Audit Breakdown (Count × Coefficient = Penalty)");
  y = table(
    pdf, y,
    [["Category", "Type", "Count", "Coefficient", "Penalty"]],
    t.auditBreakdown.map((r) => [
      r.label, r.kind, r.count, r.coefficient, r.penalty.toFixed(2),
    ]),
  );

  // ---------- Structural Defects ----------
  y = sectionHeader(pdf, y, "Structural Defects (Root Cause)");
  const byClass = t.byClass;
  y = table(
    pdf, y,
    [["Defect", "Count"]],
    [
      ["Missing Columns", byClass["Missing Column"] ?? 0],
      ["Extra Columns", byClass["Extra Column"] ?? 0],
      ["Missing Rows", byClass["Missing Row"] ?? 0],
      ["Extra Rows", byClass["Extra Row"] ?? 0],
      ["Row Shifts", byClass["Row Shift"] ?? 0],
      ["Column Shifts", byClass["Column Shift"] ?? 0],
    ],
  );

  // ---------- Per-sheet Analytics ----------
  onProgress?.("Writing per-sheet analytics");
  y = sectionHeader(pdf, y, "Per-Sheet Analytics");
  y = table(
    pdf, y,
    [["Sheet", "Rows", "Cols", "Compared", "Errors", "Score", "Risk", "Status"]],
    sheetStats.map((s) => [
      s.name, s.rows, s.cols, s.compared, s.errors,
      `${s.score.toFixed(1)}%`, s.risk, s.status,
    ]),
    {
      columnStyles: {
        0: { cellWidth: 130 },
        5: { halign: "right" },
        6: { halign: "center" },
        7: { halign: "center" },
      },
    },
  );

  // ---------- Top Findings ----------
  onProgress?.("Writing top findings");
  y = sectionHeader(pdf, y, `Top Findings (${c.topFindings.length})`);
  if (c.topFindings.length === 0) {
    y = paragraph(pdf, y, "No findings — workbook matches the reviewer reference.", { muted: true });
  } else {
    y = table(
      pdf, y,
      [["Sheet", "Cell", "Class", "Severity", "Expected", "Actual"]],
      c.topFindings.map((e: ErrorRecord) => [
        e.sheet, e.cellRef, e.errorClass, e.severity,
        // Allow autoTable's linebreak to wrap long Arabic strings.
        e.expected, e.actual,
      ]),
      {
        styles: { font: PDF_FONT_NAME, fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 38 },
          2: { cellWidth: 70 },
          3: { cellWidth: 46 },
          4: { cellWidth: "auto" },
          5: { cellWidth: "auto" },
        },
      },
    );
  }

  // ---------- Recommendations ----------
  y = sectionHeader(pdf, y, "Recommendations");
  for (const rec of c.recommendations) {
    y = paragraph(pdf, y, `• ${rec}`);
  }

  footer(pdf);
  onProgress?.("Saving file");
  pdf.save(filename);
}

// ---------- Backward-compatible legacy wrapper ----------
export async function exportElementToPDF(
  _el: HTMLElement,
  filename: string,
  report?: WorkbookReport,
  opts?: ExportOptions,
): Promise<void> {
  if (!report) throw new Error("exportElementToPDF: a WorkbookReport is required for structured export.");
  return exportReportToPDF(report, filename, opts);
}

// ---------- CSV / JSON / XLSX side exports ----------

function flattenErrors(report: WorkbookReport): ErrorRecord[] {
  const out: ErrorRecord[] = [];
  for (const s of report.sheets) for (const e of s.errors) out.push(e);
  return out;
}

function downloadBlob(data: BlobPart, filename: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

export function exportReportToCSV(report: WorkbookReport, filename: string) {
  const headers = [
    "sheet","cellRef","row","col","errorClass","severity","penalty",
    "expected","actual","normalizedExpected","normalizedActual","similarityPct","isHeader","note",
  ];
  const rows = flattenErrors(report).map((e) => headers.map((h) => {
    const v = (e as unknown as Record<string, unknown>)[h];
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(","));
  // BOM ensures Excel reads UTF-8 Arabic correctly.
  const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
  downloadBlob(csv, filename, "text/csv;charset=utf-8");
}

export function exportReportToJSON(report: WorkbookReport, filename: string) {
  const safe = JSON.parse(JSON.stringify({
    metadata: report.metadata,
    strictMode: report.strictMode,
    totals: report.totals,
    grade: report.grade,
    patterns: report.patterns,
    excludedSheets: report.excludedSheets,
    sheets: report.sheets.map((s) => ({
      name: s.name, rowCount: s.rowCount, colCount: s.colCount,
      comparedCells: s.comparedCells, headerRows: s.headerRows,
      errors: s.errors,
    })),
  }));
  downloadBlob(JSON.stringify(safe, null, 2), filename, "application/json");
}

// Silence unused-import warning while keeping the helper available for callers
// that want to peek at RTL detection outside the PDF pipeline.
void containsRTL;

export function exportReportToXLSX(report: WorkbookReport, filename: string) {
  const wb = XLSX.utils.book_new();
  const t = report.totals;
  const summary: (string | number)[][] = [
    ["Field", "Value"],
    ["Reviewer file", report.metadata.fileBName],
    ["Employee file", report.metadata.fileAName],
    ["Generated", report.metadata.timestamp],
    ["Sheets", report.sheets.length],
    ["Compliance Score", t.compliance.complianceScore],
    ["Risk Score", t.compliance.riskScore],
    ["Grade", t.compliance.grade],
    ["Structural Score", t.structuralScore],
    ["Data Score", t.dataScore],
    ["Final Audit Score", t.finalAuditScore],
    ["Base Accuracy %", t.baseAccuracy],
    ["Total Errors", t.totalErrors],
    ["Total Penalty", t.totalPenalty],
    ["Score Formula", t.compliance.scoreFormula],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

  const sheetStats: (string | number)[][] = [
    ["Sheet","Rows","Cols","Compared","Errors","Score","Risk","Status"],
  ];
  for (const s of sheetAnalytics(report))
    sheetStats.push([s.name, s.rows, s.cols, s.compared, s.errors,
                     +s.score.toFixed(2), s.risk, s.status]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetStats), "Per-Sheet");

  const breakdown: (string | number)[][] = [["Category","Kind","Count","Coefficient","Penalty"]];
  for (const r of t.auditBreakdown) breakdown.push([r.label, r.kind, r.count, r.coefficient, r.penalty]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(breakdown), "Audit Breakdown");

  const errs = flattenErrors(report);
  const errSheet: (string | number | boolean)[][] = [
    ["Sheet","Cell","Row","Col","Class","Severity","Penalty","Expected","Actual","Similarity %","Header","Note"],
  ];
  for (const e of errs) errSheet.push([
    e.sheet, e.cellRef, e.row, e.col, e.errorClass, e.severity, e.penalty,
    e.expected, e.actual, e.similarityPct, e.isHeader, e.note ?? "",
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(errSheet), "Errors");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(out, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
