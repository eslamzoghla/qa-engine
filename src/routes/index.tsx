import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, FileSpreadsheet, RotateCcw, Download, Loader2 } from "lucide-react";
import { QAProvider, useQA } from "@/lib/qa-store";
import { UploadCard } from "@/components/qa/UploadCard";
import { ConfigPanel } from "@/components/qa/ConfigPanel";
import { Scorecard } from "@/components/qa/Scorecard";
import { Charts } from "@/components/qa/Charts";
import { SheetTabs } from "@/components/qa/SheetTabs";
import { Narrative, Coaching, Patterns } from "@/components/qa/Narrative";
import { ErrorTable } from "@/components/qa/ErrorTable";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { exportElementToPDF } from "@/lib/pdf-export";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QA Engine — Data Entry Performance Auditor" },
      { name: "description", content: "Compare employee Excel submissions against reviewer ground truth with penalty-weighted scoring, structural shift detection, and coaching recommendations." },
      { property: "og:title", content: "QA Engine — Data Entry Performance Auditor" },
      { property: "og:description", content: "Enterprise Excel comparison with classification, scoring, and AI-assisted coaching." },
    ],
  }),
  component: () => (
    <QAProvider>
      <Page />
      <Toaster richColors position="top-right" />
    </QAProvider>
  ),
});

function Page() {
  const { report, setReport, employeeName } = useQA();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      const safeName = (employeeName || "employee").replace(/[^a-z0-9\-_]+/gi, "_");
      const stamp = new Date().toISOString().slice(0, 10);
      await exportElementToPDF(dashboardRef.current, `qa-report_${safeName}_${stamp}.pdf`);
      toast.success("Dashboard exported as PDF");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {!report && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="grid lg:grid-cols-3 gap-6 mt-2">
            <div className="lg:col-span-2 space-y-4">
              <Hero />
              <UploadCard />
            </div>
            <div className="space-y-4">
              <ConfigPanel />
            </div>
          </motion.div>
        )}
        {report && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-muted-foreground font-mono truncate">
                {employeeName && (
                  <>
                    <span className="font-semibold text-foreground">Employee:</span> {employeeName}
                    <span className="mx-2">·</span>
                  </>
                )}
                <span className="font-semibold text-foreground">A:</span> {report.metadata.fileAName}
                <span className="mx-2">·</span>
                <span className="font-semibold text-foreground">B:</span> {report.metadata.fileBName}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleExport} disabled={exporting}>
                  {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                  {exporting ? "Exporting…" : "Download PDF"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setReport(null)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> New evaluation
                </Button>
              </div>
            </div>
            <div ref={dashboardRef} className="space-y-6 bg-background p-2">
              <Scorecard />
              <Charts />
              <Patterns />
              <SheetTabs />
              <ErrorTable />
              <Narrative />
              <Coaching />
            </div>
          </>
        )}
      </main>
      <footer className="max-w-[1400px] mx-auto px-6 py-8 text-xs text-muted-foreground border-t border-border mt-12">
        Quality Assurance Engine · classifies via shift→missing→range→numeric→text priority · all processing happens locally in your browser.
      </footer>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary text-primary-foreground rounded-lg p-1.5">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">QA Engine</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Data Entry Auditor</div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Local-only · No upload to servers
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/8 via-surface to-surface p-6 shadow-sm">
      <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Enterprise Engine
      </div>
      <h1 className="text-3xl font-bold tracking-tight mt-3">
        Audit data-entry performance with cell-level precision.
      </h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
        Upload the employee submission and reviewer reference. We classify every defect across the
        full 5-priority taxonomy — structural shifts, omissions, range/sequence drift, numeric
        keystroke errors, and Arabic/English text deviations — then produce a weighted-accuracy
        grade, narrative evaluation, and targeted coaching recommendations.
      </p>
    </div>
  );
}
