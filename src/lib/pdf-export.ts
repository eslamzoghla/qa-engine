// Structured, multi-page PDF report for the QA Engine.
//
// Replaces the previous html2canvas + jsPDF screenshot pipeline which
// occasionally produced empty / truncated / oversized PDFs on large reports.
// We now render real text and tables via jsPDF + jspdf-autotable so the PDF
// is searchable, paginated, and bounded in file size regardless of dataset.

import jsPDF from "jspdf";
import autoTable, { type RowInput, type UserOptions } from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { WorkbookReport, ErrorRecord } from "./qa-engine";

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

function pageWidth(pdf: jsPDF) { return pdf.internal.pageSize.getWidth(); }
function pageHeight(pdf: jsPDF) { return pdf.internal.pageSize.getHeight(); }

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > pageHeight(pdf) - 40) {
    pdf.addPage();
    return 50;
  }
  return y;
}

function sectionHeader(pdf: jsPDF, y: number, title: string): number {
  y = ensureSpace(pdf, y, 30);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...COLOR_PRIMARY);
  pdf.text(title, 40, y);
  pdf.setDrawColor(...COLOR_PRIMARY);
  pdf.setLineWidth(0.6);
  pdf.line(40, y + 4, pageWidth(pdf) - 40, y + 4);
  pdf.setTextColor(0, 0, 0);
  return y + 18;
}

function paragraph(pdf: jsPDF, y: number, text: string, opts?: { size?: number; muted?: boolean }): number {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(opts?.size ?? 10);
  if (opts?.muted) pdf.setTextColor(...COLOR_MUTED); else pdf.setTextColor(0, 0, 0);
  const lines = pdf.splitTextToSize(text, pageWidth(pdf) - 80) as string[];
  for (const line of lines) {
    y = ensureSpace(pdf, y, 14);
    pdf.text(line, 40, y);
    y += 14;
  }
  pdf.setTextColor(0, 0, 0);
  return y + 4;
}

function table(pdf: jsPDF, y: number, head: string[][], body: RowInput[], opts?: Partial<UserOptions>): number {
  autoTable(pdf, {
    startY: y,
    head, body,
    margin: { left: 40, right: 40 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: COLOR_PRIMARY, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    ...opts,
  });
  type AutoTableJsPDF = jsPDF & { lastAutoTable?: { finalY: number } };
  return ((pdf as AutoTableJsPDF).lastAutoTable?.finalY ?? y) + 14;
}

function footer(pdf: jsPDF) {
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...COLOR_MUTED);
    pdf.text(
      `QA Engine · generated ${new Date().toLocaleString()}`,
      40, pageHeight(pdf) - 20,
    );
    pdf.text(`Page ${i} / ${total}`, pageWidth(pdf) - 80, pageHeight(pdf) - 20);
  }
  pdf.setTextColor(0, 0, 0);
}

export async function exportReportToPDF(
  report: WorkbookReport,
  filename: string,
  opts: ExportOptions = {},
): Promise<void> {
  const { onProgress } = opts;
  onProgress?.("Initialising document");
  const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const t = report.totals;
  const c = t.compliance;

  // ---------- Cover ----------
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(...COLOR_PRIMARY);
  pdf.text("QA Audit Report", 40, 80);

  pdf.setFontSize(11);
  pdf.setTextColor(...COLOR_MUTED);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Generated ${new Date().toLocaleString()}`, 40, 100);
  pdf.setTextColor(0, 0, 0);

  let y = 140;
  pdf.setFontSize(10);
  const meta: Array<[string, string]> = [
    ["Employee", opts.employeeName || "—"],
    ["Reviewer file", report.metadata.fileBName],
    ["Employee file", report.metadata.fileAName],
    ["Sheets evaluated", String(report.sheets.length)],
    ["Strict mode", report.strictMode ? "ON" : "OFF"],
  ];
  y = table(pdf, y, [["Field", "Value"]], meta.map((m) => [m[0], m[1]]));

  // Big score banner
  y = ensureSpace(pdf, y, 110);
  pdf.setDrawColor(...COLOR_PRIMARY);
  pdf.setFillColor(245, 247, 255);
  pdf.roundedRect(40, y, pageWidth(pdf) - 80, 100, 6, 6, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...COLOR_MUTED);
  pdf.text("COMPLIANCE SCORE", 60, y + 25);
  pdf.text("RISK SCORE", 240, y + 25);
  pdf.text("GRADE", 420, y + 25);
  pdf.setFontSize(28);
  pdf.setTextColor(...toneColor(c.complianceScore));
  pdf.text(`${c.complianceScore.toFixed(1)}`, 60, y + 65);
  pdf.setTextColor(...toneColor(100 - c.riskScore));
  pdf.text(`${c.riskScore.toFixed(1)}`, 240, y + 65);
  pdf.setTextColor(...toneColor(c.complianceScore));
  pdf.text(c.grade, 420, y + 65);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...COLOR_MUTED);
  pdf.text(c.gradeLabel, 420, y + 82);
  pdf.setTextColor(0, 0, 0);
  y += 120;

  // ---------- Executive Summary ----------
  onProgress?.("Writing executive summary");
  y = sectionHeader(pdf, y, "Executive Summary");
  y = paragraph(pdf, y, c.executiveSummary);

  // ---------- Audit Scores ----------
  y = sectionHeader(pdf, y, "Audit Scores");
  y = table(
    pdf, y,
    [["Score", "Value", "Penalty"]],
    [
      ["Structural Score", t.structuralScore.toFixed(2), t.structuralPenalty.toFixed(2)],
      ["Data Score", t.dataScore.toFixed(2), t.dataPenalty.toFixed(2)],
      ["Final Audit Score (40/60)", t.finalAuditScore.toFixed(2), (t.structuralPenalty + t.dataPenalty).toFixed(2)],
      ["Base Accuracy", `${t.baseAccuracy.toFixed(2)}%`, "—"],
      ["Weighted Accuracy", `${t.weightedAccuracy.toFixed(2)}%`, "—"],
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

  // ---------- Per-sheet Summary ----------
  onProgress?.("Writing per-sheet summary");
  y = sectionHeader(pdf, y, "Per-Sheet Summary");
  y = table(
    pdf, y,
    [["Sheet", "Rows", "Cols", "Compared", "Errors"]],
    report.sheets.map((s) => [
      s.name, s.rowCount, s.colCount, s.comparedCells, s.errors.length,
    ]),
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
        truncate(e.expected, 40), truncate(e.actual, 40),
      ]),
      { styles: { fontSize: 8, cellPadding: 3 } },
    );
  }

  // ---------- Recommendations ----------
  y = sectionHeader(pdf, y, "Recommendations");
  for (const rec of c.recommendations) {
    y = paragraph(pdf, y, `• ${rec}`);
  }

  footer(pdf);
  onProgress?.("Saving");
  pdf.save(filename);
}

function truncate(s: string, n: number): string {
  s = String(s ?? "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ---------- Backward-compatible legacy wrapper ----------
// Older call sites passed an HTMLElement; new code should call exportReportToPDF.
// We keep the signature so existing imports continue to compile, but it ignores
// the element and renders the structured report instead when a report is provided.
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
  const csv = [headers.join(","), ...rows].join("\n");
  downloadBlob(csv, filename, "text/csv;charset=utf-8");
}

export function exportReportToJSON(report: WorkbookReport, filename: string) {
  // Strip non-serialisable Set<string>; everything else is plain data.
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
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

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
