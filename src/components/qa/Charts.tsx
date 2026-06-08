import { useQA } from "@/lib/qa-store";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "var(--critical)", HIGH: "var(--high)", HEADER: "var(--info)",
  MEDIUM: "var(--medium)", LOW: "var(--low)",
};

const CLASS_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
  "var(--high)", "var(--medium)", "var(--low)", "var(--info)",
];

export function Charts() {
  const { report } = useQA();
  if (!report) return null;

  const sevData = Object.entries(report.totals.bySeverity)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const classData = Object.entries(report.totals.byClass)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-2xl bg-surface border border-border p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-3">Severity Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={sevData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {sevData.map((d) => (
                  <Cell key={d.name} fill={SEVERITY_COLORS[d.name]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {sevData.map((d) => (
            <div key={d.name} className="flex items-center gap-1.5 text-xs">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: SEVERITY_COLORS[d.name] }} />
              <span className="font-medium">{d.name}</span>
              <span className="text-muted-foreground tabular-nums">{d.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-border p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-3">Root Cause Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={classData} layout="vertical" margin={{ left: 20, right: 12, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={10} width={140} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {classData.map((_, i) => (
                  <Cell key={i} fill={CLASS_COLORS[i % CLASS_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
