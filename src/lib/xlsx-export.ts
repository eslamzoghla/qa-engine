import * as XLSX from "xlsx";
import type { WorkbookReport } from "./qa-engine";

export function exportToXLSX(report: WorkbookReport) {
  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summaryData = [
    ["QA Engine Evaluation Report"],
    ["File A", report.metadata.fileAName],
    ["File B", report.metadata.fileBName],
    ["Timestamp", report.metadata.timestamp],
    [],
    ["Executive Summary"],
    ["Performance Grade", report.grade.label],
    ["Base Accuracy", `${report.totals.baseAccuracy.toFixed(2)}%`],
    ["Weighted Accuracy", `${report.totals.weightedAccuracy.toFixed(2)}%`],
    ["Total Errors", report.totals.totalErrors],
    ["Penalty Points", report.totals.totalPenalty],
    ["Compared Cells", report.totals.comparedCells],
    ["Workload (Reviewer Hours)", report.totals.workloadHours.toFixed(2)],
    [],
    ["Defects by Severity"],
    ...Object.entries(report.totals.bySeverity).map(([k, v]) => [k, v]),
    [],
    ["Defects by Class"],
    ...Object.entries(report.totals.byClass).map(([k, v]) => [k, v]),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // 2. Defect Ledger
  const ledgerHeaders = [
    "Sheet", "Cell", "Row", "Col", "Severity", "Class", "Expected", "Actual",
    "Normalized Expected", "Normalized Actual", "Similarity %", "Penalty", "Note"
  ];
  const ledgerData = report.sheets.flatMap(s => s.errors.map(e => [
    e.sheet, e.cellRef, e.row + 1, e.col + 1, e.severity, e.errorClass, e.expected, e.actual,
    e.normalizedExpected, e.normalizedActual, e.similarityPercentage.toFixed(1), e.penalty, e.note || ""
  ]));
  const wsLedger = XLSX.utils.aoa_to_sheet([ledgerHeaders, ...ledgerData]);
  XLSX.utils.book_append_sheet(wb, wsLedger, "Defect Ledger");

  // 3. Sheet Reports
  for (const sheet of report.sheets) {
    const sheetData = [
      ["Sheet Performance", sheet.name],
      ["Compared Cells", sheet.comparedCells],
      ["Total Defects", sheet.errors.length],
      [],
      ["Defects in this Sheet"],
      ["Cell", "Severity", "Class", "Expected", "Actual", "Penalty"]
    ];
    sheet.errors.forEach(e => {
        sheetData.push([e.cellRef, e.severity, e.errorClass, e.expected, e.actual, String(e.penalty)]);
    });
    const wsSheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, wsSheet, sheet.name.slice(0, 31));
  }

  XLSX.writeFile(wb, `QA_Report_${Date.now()}.xlsx`);
}
