import { createContext, useContext, useState, type ReactNode } from "react";
import type { WorkbookReport, QAConfig } from "@/lib/qa-engine";
import { DEFAULT_CONFIG } from "@/lib/qa-engine";

interface QAStore {
  report: WorkbookReport | null;
  setReport: (r: WorkbookReport | null) => void;
  config: QAConfig;
  setConfig: (c: QAConfig) => void;
  activeSheet: string | null;
  setActiveSheet: (s: string | null) => void;
}

const Ctx = createContext<QAStore | null>(null);

export function QAProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<WorkbookReport | null>(null);
  const [config, setConfig] = useState<QAConfig>(DEFAULT_CONFIG);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  return (
    <Ctx.Provider value={{ report, setReport, config, setConfig, activeSheet, setActiveSheet }}>
      {children}
    </Ctx.Provider>
  );
}

export function useQA() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useQA outside provider");
  return v;
}
