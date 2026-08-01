import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Cpu, Info, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExtractionIssue, ExtractionMethod, ExtractionResult } from "@/services/extraction";

const GOLD = "hsl(38 57% 54%)";

const METHOD_LABELS: Record<ExtractionMethod, string> = {
  layout: "Lectura directa del PDF (sin IA)",
  "docx-table": "Lectura directa del Word (sin IA)",
  "ai-text": "Reconstruido con IA a partir del texto",
  "ai-vision": "Leído con IA (documento escaneado)",
  none: "Sin datos",
};

const USES_AI: Record<ExtractionMethod, boolean> = {
  layout: false,
  "docx-table": false,
  "ai-text": true,
  "ai-vision": true,
  none: false,
};

function IssueIcon({ level }: { level: ExtractionIssue["level"] }) {
  if (level === "error") return <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-destructive" />;
  if (level === "warning") return <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "hsl(38 70% 42%)" }} />;
  return <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />;
}

interface ExtractionReportProps {
  result: ExtractionResult;
  hasApiKey: boolean;
  isVerifying: boolean;
  onVerify: () => void;
  aiIssues: ExtractionIssue[];
}

export function ExtractionReport({
  result,
  hasApiKey,
  isVerifying,
  onVerify,
  aiIssues,
}: ExtractionReportProps) {
  const usedAi = USES_AI[result.method];
  const confidencePct = Math.round(result.confidence * 100);
  const warnings = [...result.issues, ...aiIssues].filter((i) => i.level !== "info");
  const notes = [...result.issues, ...aiIssues].filter((i) => i.level === "info");
  const canVerify = hasApiKey && result.rows.length > 0 && result.documents.some((d) => d.plainText.trim());

  return (
    <div className="border border-border bg-card shadow-sm">
      <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {usedAi ? (
            <Cpu className="w-4 h-4" style={{ color: GOLD }} />
          ) : (
            <ShieldCheck className="w-4 h-4" style={{ color: "hsl(142 50% 38%)" }} />
          )}
          <div>
            <p className="text-xs font-display font-semibold text-foreground uppercase" style={{ letterSpacing: "0.14em" }}>
              {METHOD_LABELS[result.method]}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {result.rows.length} {result.rows.length === 1 ? "línea" : "líneas"} ·{" "}
              {result.detectedColumns.length} columnas reconocidas · fiabilidad {confidencePct}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block" style={{ width: 90, height: 4, background: "hsl(var(--muted))" }}>
            <div
              style={{
                width: `${confidencePct}%`,
                height: "100%",
                background: confidencePct >= 75 ? "hsl(142 50% 42%)" : confidencePct >= 45 ? GOLD : "hsl(0 65% 52%)",
              }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-medium uppercase"
            style={{ letterSpacing: "0.08em" }}
            onClick={onVerify}
            disabled={!canVerify || isVerifying}
            title={
              hasApiKey
                ? "Contrasta la tabla con el texto del documento usando la IA"
                : "Configura una clave de OpenAI para usar la verificación"
            }
          >
            {isVerifying ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5 mr-1.5" />}
            Verificar con IA
          </Button>
        </div>
      </div>

      {result.detectedColumns.length > 0 && (
        <div className="px-5 py-3 border-b border-border flex flex-wrap gap-1.5">
          {result.detectedColumns.map((column) => (
            <span
              key={column}
              className="text-xs px-2 py-0.5 border border-border text-muted-foreground"
              style={{ letterSpacing: "0.04em" }}
            >
              {column}
            </span>
          ))}
        </div>
      )}

      <div className="px-5 py-3 space-y-1.5">
        {warnings.length === 0 && notes.length === 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "hsl(142 50% 42%)" }} />
            Sin incidencias.
          </p>
        )}
        {warnings.map((issue, i) => (
          <p key={`w-${i}`} className="text-xs text-foreground flex items-start gap-2">
            <IssueIcon level={issue.level} />
            <span>{issue.message}</span>
          </p>
        ))}
        {notes.map((issue, i) => (
          <p key={`n-${i}`} className="text-xs text-muted-foreground flex items-start gap-2">
            <IssueIcon level={issue.level} />
            <span>{issue.message}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
