import { useQA } from "@/lib/qa-store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2 } from "lucide-react";

export function ConfigPanel() {
  const { config, setConfig } = useQA();
  const set = <K extends keyof typeof config>(k: K, v: (typeof config)[K]) =>
    setConfig({ ...config, [k]: v });
  return (
    <div className="rounded-2xl bg-surface border border-border p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Engine Configuration</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Major variance %">
          <Input type="number" step="0.05" value={config.numericMajorVariance}
            onChange={(e) => set("numericMajorVariance", Number(e.target.value))} />
        </Field>
        <Field label="Major absolute Δ">
          <Input type="number" value={config.numericMajorAbsolute}
            onChange={(e) => set("numericMajorAbsolute", Number(e.target.value))} />
        </Field>
        <Field label="Numeric tolerance">
          <Input type="number" step="0.01" value={config.numericTolerance}
            onChange={(e) => set("numericTolerance", Number(e.target.value))} />
        </Field>
        <Field label="Tolerance mode">
          <Select value={config.numericToleranceMode} onValueChange={(v) => set("numericToleranceMode", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENTAGE">Percentage</SelectItem>
              <SelectItem value="ABSOLUTE">Absolute</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Min shift cells">
          <Input type="number" value={config.minimumShiftCells}
            onChange={(e) => set("minimumShiftCells", Number(e.target.value))} />
        </Field>
        <Field label="Shift threshold">
          <Input type="number" step="0.05" value={config.shiftDetectionThreshold}
            onChange={(e) => set("shiftDetectionThreshold", Number(e.target.value))} />
        </Field>
        <Field label="Header penalty">
          <Input type="number" value={config.headerPenalty}
            onChange={(e) => set("headerPenalty", Number(e.target.value))} />
        </Field>
        <Field label="Strict mode">
          <Select value={config.strictMode} onValueChange={(v) => set("strictMode", v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AUTO">Auto</SelectItem>
              <SelectItem value="ON">On</SelectItem>
              <SelectItem value="OFF">Off</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-5 pt-4 border-t border-border">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Audit Penalty Coefficients
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Extra Table">
            <Input type="number" step="1" value={config.extraTableCoefficient}
              onChange={(e) => set("extraTableCoefficient", Number(e.target.value))} />
          </Field>
          <Field label="Missing Table">
            <Input type="number" step="1" value={config.missingTableCoefficient}
              onChange={(e) => set("missingTableCoefficient", Number(e.target.value))} />
          </Field>
          <Field label="Extra Column">
            <Input type="number" step="1" value={config.extraColumnCoefficient}
              onChange={(e) => set("extraColumnCoefficient", Number(e.target.value))} />
          </Field>
          <Field label="Missing Column">
            <Input type="number" step="1" value={config.missingColumnCoefficient}
              onChange={(e) => set("missingColumnCoefficient", Number(e.target.value))} />
          </Field>
          <Field label="Extra Row">
            <Input type="number" step="0.5" value={config.extraRowCoefficient}
              onChange={(e) => set("extraRowCoefficient", Number(e.target.value))} />
          </Field>
          <Field label="Missing Row">
            <Input type="number" step="0.5" value={config.missingRowCoefficient}
              onChange={(e) => set("missingRowCoefficient", Number(e.target.value))} />
          </Field>
          <Field label="Numeric Diff">
            <Input type="number" step="0.01" value={config.numericDifferenceCoefficient}
              onChange={(e) => set("numericDifferenceCoefficient", Number(e.target.value))} />
          </Field>
          <Field label="Text Diff">
            <Input type="number" step="0.01" value={config.textDifferenceCoefficient}
              onChange={(e) => set("textDifferenceCoefficient", Number(e.target.value))} />
          </Field>
          <Field label="Empty Cell Diff">
            <Input type="number" step="0.01" value={config.emptyCellDifferenceCoefficient}
              onChange={(e) => set("emptyCellDifferenceCoefficient", Number(e.target.value))} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
