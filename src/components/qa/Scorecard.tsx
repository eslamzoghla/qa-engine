import { useQA } from "@/lib/qa-store";
import { motion } from "framer-motion";
import { TrendingUp, AlertOctagon, Clock, Layers, FileWarning } from "lucide-react";

function Stat({ icon: Icon, label, value, sub, tone = "default" }: {
  icon: any; label: string; value: string; sub?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneCls = {
    default: "text-foreground",
    good: "text-success",
    warn: "text-medium",
    bad: "text-critical",
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-surface border border-border p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${toneCls}`} />
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </motion.div>
  );
}

const GRADE_TONE: Record<string, "good" | "warn" | "bad" | "default"> = {
  Outstanding: "good", Excellent: "good", "Very Good": "good", Good: "good",
  Fair: "warn", "Needs Improvement": "warn", Poor: "bad",
};

export function Scorecard() {
  const { report, employeeName } = useQA();
  if (!report) return null;
  const t = report.totals;
  const grade = report.grade;
  const tone = GRADE_TONE[grade.label] ?? "default";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-surface to-surface border border-border p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {employeeName && (
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Employee</div>
            )}
            {employeeName && (
              <div className="text-lg font-semibold text-foreground mb-2">{employeeName}</div>
            )}
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Performance Grade</div>
            <div className={`text-4xl font-bold tracking-tight mt-1 ${
              tone === "good" ? "text-success" : tone === "warn" ? "text-medium" : tone === "bad" ? "text-critical" : ""
            }`}>{grade.label}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Tier {grade.tier} of 7 · {report.sheets.length} sheets evaluated
              {report.strictMode && <span className="ml-2 inline-flex items-center rounded-full bg-medium/15 text-medium px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Strict Mode</span>}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-5xl font-bold tabular-nums tracking-tight">{t.baseAccuracy.toFixed(2)}</div>
            <div className="text-lg text-muted-foreground">%</div>
            <div className="ml-2 text-xs text-muted-foreground">accuracy</div>
          </div>
        </div>
        {grade.rationale.length > 1 && (
          <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
            {grade.rationale.slice(1).map((r, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <AlertOctagon className="h-3 w-3 text-medium" /> {r}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Stat icon={Layers} label="Compared Cells" value={t.comparedCells.toLocaleString()} />
        <Stat icon={FileWarning} label="Total Errors" value={t.totalErrors.toLocaleString()}
              tone={t.totalErrors > 0 ? "warn" : "good"} />
        <Stat icon={TrendingUp} label="Penalty Points" value={t.totalPenalty.toLocaleString()}
              tone={t.totalPenalty > 50 ? "bad" : t.totalPenalty > 10 ? "warn" : "good"} />
        <Stat icon={AlertOctagon} label="Error / 10k" value={t.errorRatePer10k.toFixed(1)} />
        <Stat icon={Clock} label="Workload" value={`${t.workloadHours.toFixed(1)}h`}
              sub="reviewer remediation" />
      </div>

      <CompliancePanel report={report} />
      <AuditScorePanel report={report} />
      <AuditBreakdownPanel report={report} />
      <StructuralPanel report={report} />
    </div>
  );
}

function CompliancePanel({ report }: { report: NonNullable<ReturnType<typeof useQA>["report"]> }) {
  const c = report.totals.compliance;
  const toneScore = (n: number) => n >= 90 ? "text-success" : n >= 70 ? "text-medium" : "text-critical";
  const toneRisk = (n: number) => n >= 30 ? "text-critical" : n >= 10 ? "text-medium" : "text-success";
  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-surface to-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Compliance Report</div>
          <div className="text-sm text-muted-foreground mt-1 max-w-2xl">{c.executiveSummary}</div>
        </div>
        <div className="flex items-end gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Compliance</div>
            <div className={`text-3xl font-bold tabular-nums ${toneScore(c.complianceScore)}`}>{c.complianceScore.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk</div>
            <div className={`text-3xl font-bold tabular-nums ${toneRisk(c.riskScore)}`}>{c.riskScore.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Grade</div>
            <div className={`text-3xl font-bold ${toneScore(c.complianceScore)}`}>{c.grade}</div>
            <div className="text-[10px] text-muted-foreground">{c.gradeLabel}</div>
          </div>
        </div>
      </div>
      {c.recommendations.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Recommendations</div>
          <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-5">
            {c.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function AuditScorePanel({ report }: { report: NonNullable<ReturnType<typeof useQA>["report"]> }) {
  const t = report.totals;
  const toneScore = (n: number) => n >= 90 ? "text-success" : n >= 70 ? "text-medium" : "text-critical";
  return (
    <div className="rounded-2xl bg-surface border border-border p-5 shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
        Audit Score (Structural 40% · Data 60%)
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface-2/30 p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Structural Score</div>
          <div className={`text-3xl font-bold tabular-nums ${toneScore(t.structuralScore)}`}>{t.structuralScore.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground mt-1">Penalty: {t.structuralPenalty.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-border bg-surface-2/30 p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Data Score</div>
          <div className={`text-3xl font-bold tabular-nums ${toneScore(t.dataScore)}`}>{t.dataScore.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground mt-1">Penalty: {t.dataPenalty.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Final Audit Score</div>
          <div className={`text-4xl font-bold tabular-nums ${toneScore(t.finalAuditScore)}`}>{t.finalAuditScore.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-1">Total penalty: {(t.structuralPenalty + t.dataPenalty).toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

function AuditBreakdownPanel({ report }: { report: NonNullable<ReturnType<typeof useQA>["report"]> }) {
  const rows = report.totals.auditBreakdown;
  return (
    <div className="rounded-2xl bg-surface border border-border p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Audit Summary</div>
          <div className="text-xs text-muted-foreground mt-0.5">Count × Coefficient = Penalty Contribution</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="text-left py-2 font-medium">Category</th>
              <th className="text-left py-2 font-medium">Type</th>
              <th className="text-right py-2 font-medium">Count</th>
              <th className="text-right py-2 font-medium">Coefficient</th>
              <th className="text-right py-2 font-medium">Penalty</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-border/40">
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-xs text-muted-foreground capitalize">{r.kind}</td>
                <td className="py-2 text-right tabular-nums">{r.count}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">{r.coefficient}</td>
                <td className={`py-2 text-right tabular-nums font-medium ${r.penalty > 0 ? "text-critical" : "text-muted-foreground"}`}>
                  {r.penalty.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StructuralPanel({ report }: { report: NonNullable<ReturnType<typeof useQA>["report"]> }) {
  const c = report.totals.byClass;
  const missingCols = c["Missing Column"] ?? 0;
  const extraCols = c["Extra Column"] ?? 0;
  const missingRows = c["Missing Row"] ?? 0;
  const extraRows = c["Extra Row"] ?? 0;
  const rowShifts = c["Row Shift"] ?? 0;
  const colShifts = c["Column Shift"] ?? 0;
  const total = missingCols + extraCols + missingRows + extraRows + rowShifts + colShifts;

  return (
    <div className="rounded-2xl bg-surface border border-border p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Structural Defects (Root Cause)</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Structure is validated before any cell-level comparison. Affected cells are excluded from downstream classification.
          </div>
        </div>
        <div className={`text-2xl font-bold tabular-nums ${total > 0 ? "text-critical" : "text-success"}`}>
          {total}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <SCell label="Missing Columns" value={missingCols} />
        <SCell label="Extra Columns" value={extraCols} />
        <SCell label="Missing Rows" value={missingRows} />
        <SCell label="Extra Rows" value={extraRows} />
        <SCell label="Row Shifts" value={rowShifts} />
        <SCell label="Column Shifts" value={colShifts} />
      </div>
    </div>
  );
}

function SCell({ label, value }: { label: string; value: number }) {
  const tone = value === 0 ? "text-muted-foreground" : "text-critical";
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
