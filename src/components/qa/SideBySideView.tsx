import { useMemo, useRef, useEffect } from "react";
import type { SheetReport, ErrorRecord } from "@/lib/qa-engine";
import { colLetter } from "@/lib/qa-engine";
import { AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const MAX_ROWS = 100;
const MAX_COLS = 20;

const SEVERITY_CLASS: Record<string, string> = {
  CRITICAL: "bg-critical text-white",
  HIGH: "bg-high text-white",
  HEADER: "bg-info text-white",
  MEDIUM: "bg-medium text-black",
  LOW: "bg-low text-black",
};

export function SideBySideView({ sheet }: { sheet: SheetReport }) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const errorMap = useMemo(() => {
    const m = new Map<string, ErrorRecord>();
    for (const e of sheet.errors) {
      if (e.errorClass !== "Row Shift" && e.errorClass !== "Column Shift") {
        m.set(`${e.row},${e.col}`, e);
      }
    }
    return m;
  }, [sheet]);

  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;

    const syncLeft = () => {
      right.scrollTop = left.scrollTop;
      right.scrollLeft = left.scrollLeft;
    };
    const syncRight = () => {
      left.scrollTop = right.scrollTop;
      left.scrollLeft = right.scrollLeft;
    };

    left.addEventListener("scroll", syncLeft);
    right.addEventListener("scroll", syncRight);
    return () => {
      left.removeEventListener("scroll", syncLeft);
      right.removeEventListener("scroll", syncRight);
    };
  }, []);

  const totalRows = Math.max(sheet.gridA.length, sheet.gridB.length);
  const totalCols = sheet.colCount;
  const rows = Math.min(totalRows, MAX_ROWS);
  const cols = Math.min(totalCols, MAX_COLS);

  return (
    <div className="grid grid-cols-2 gap-px bg-border">
      <div ref={leftRef} className="bg-surface overflow-auto max-h-[600px]">
        <div className="px-3 py-1.5 bg-surface-2 border-b border-border sticky top-0 z-20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          File A — Employee
        </div>
        <GridTable grid={sheet.gridA} rows={rows} cols={cols} errorMap={errorMap} sheet={sheet} side="A" />
      </div>
      <div ref={rightRef} className="bg-surface overflow-auto max-h-[600px]">
        <div className="px-3 py-1.5 bg-surface-2 border-b border-border sticky top-0 z-20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          File B — Reviewer
        </div>
        <GridTable grid={sheet.gridB} rows={rows} cols={cols} errorMap={errorMap} sheet={sheet} side="B" />
      </div>
    </div>
  );
}

function GridTable({ grid, rows, cols, errorMap, sheet, side }: {
  grid: string[][]; rows: number; cols: number; errorMap: Map<string, ErrorRecord>; sheet: SheetReport; side: "A" | "B"
}) {
  return (
    <table className="text-[10px] font-mono border-separate border-spacing-0 w-full">
      <thead className="sticky top-[25px] z-10 bg-surface-2">
        <tr>
          <th className="sticky left-0 z-20 bg-surface-2 border-b border-r border-border px-1 py-0.5 text-muted-foreground font-normal w-8 text-[9px]">#</th>
          {Array.from({ length: cols }).map((_, c) => (
            <th key={c} className="border-b border-r border-border px-1 py-0.5 text-muted-foreground font-medium min-w-[80px]">
              {colLetter(c)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            <td className="sticky left-0 z-10 bg-surface-2 border-b border-r border-border px-1 py-0.5 text-muted-foreground tabular-nums w-8 text-right text-[9px]">
              {r + 1}
            </td>
            {Array.from({ length: cols }).map((_, c) => {
              const key = `${r},${c}`;
              const err = errorMap.get(key);
              const isShift = sheet.shiftCells.has(key);
              const isHeader = r < sheet.headerRows;
              const val = grid[r]?.[c] ?? "";
              return (
                <Cell key={c} err={err} isShift={isShift} isHeader={isHeader} value={String(val)} side={side} />
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Cell({ err, isShift, isHeader, value, side }: { err?: ErrorRecord; isShift: boolean; isHeader: boolean; value: string; side: "A" | "B" }) {
  let cls = "border-b border-r border-border px-1 py-0.5 truncate max-w-[120px] ";
  if (err) cls += "grid-cell-error ";
  else if (isShift) cls += "grid-cell-shift ";
  else if (isHeader) cls += "grid-cell-header ";

  const td = <td className={cls} title={value}>{value || <span className="text-muted-foreground/20">·</span>}</td>;
  if (!err) return td;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{td}</TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          <div className="font-semibold mb-1 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-critical" />
            {err.errorClass}
            <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${SEVERITY_CLASS[err.severity]}`}>{err.severity}</span>
          </div>
          <div className="space-y-0.5 font-mono">
            <div><span className="text-muted-foreground">Expected:</span> {err.expected || "∅"}</div>
            <div><span className="text-muted-foreground">Actual:</span> {err.actual || "∅"}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
