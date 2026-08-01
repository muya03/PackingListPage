import React, { useState, useCallback, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle,
  FileDown,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsPanel } from "@/components/SettingsPanel";
import { UploadZone } from "@/components/UploadZone";
import { PackingTable } from "@/components/PackingTable";
import { SessionsPanel } from "@/components/SessionsPanel";
import { ExtractionReport } from "@/components/ExtractionReport";
import { TemplateUploadPanel, type CustomTemplate } from "@/components/TemplateUploadPanel";
import {
  analyze,
  readDocuments,
  fmtNum,
  type ExtractionIssue,
  type ExtractionResult,
  type SourceDocument,
} from "@/services/extraction";
import { aiReadScan, aiReadText, aiVerify, verificationToIssues } from "@/services/aiService";
import { exportPackingListDocx } from "@/utils/exportDocx";
import { exportPackingListPdf } from "@/utils/exportPdf";
import type { PdfOrientation } from "@/utils/nexoraPdfTheme";
import { saveTemplate, loadTemplate, clearTemplate } from "@/utils/templateStorage";
import {
  EMPTY_META,
  normalizeMeta,
  normalizeRow,
  type InvoiceMeta,
  type InvoiceResponse,
  type TableRow,
} from "@/types/packing";

type AppState = "idle" | "loading" | "done" | "error";

const GOLD = "hsl(38 57% 54%)";

/** Below this the extraction is shaky enough to be worth an AI second pass. */
const LOW_CONFIDENCE = 0.5;

const META_FIELDS: { label: string; key: keyof InvoiceMeta; wide?: boolean }[] = [
  { label: "Nº Factura", key: "invoice_reference" },
  { label: "Fecha", key: "invoice_date" },
  { label: "Cliente", key: "client_name" },
  { label: "VAT Cliente", key: "client_vat" },
  { label: "Su Referencia", key: "su_referencia" },
  { label: "Forma de Pago", key: "forma_pago" },
  { label: "Último Tenedor", key: "ultimo_tenedor" },
  { label: "Contenedor", key: "contenedor" },
  { label: "Precinto", key: "precinto" },
  { label: "Total Contenedores", key: "total_contenedores" },
  { label: "Partida Arancelaria", key: "partida_arancelaria" },
  { label: "País Origen", key: "pais_origen" },
  { label: "País Destino", key: "pais_destino" },
  { label: "Proveedor", key: "supplier_name" },
  { label: "Dirección Destinatario", key: "client_address", wide: true },
  { label: "Origen de la Mercancía", key: "origen_mercancia", wide: true },
  { label: "Código C.E.E.", key: "codigo_cee", wide: true },
  { label: "Leyenda Familias", key: "familia_leyenda", wide: true },
];

function fromAiResponse(response: InvoiceResponse, method: ExtractionResult["method"]): Partial<ExtractionResult> {
  return {
    meta: normalizeMeta(response as unknown as Partial<InvoiceMeta>),
    rows: response.items.map((item) => normalizeRow(item)),
    method,
  };
}

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [sources, setSources] = useState<SourceDocument[]>([]);
  const [appState, setAppState] = useState<AppState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [meta, setMeta] = useState<InvoiceMeta>(EMPTY_META);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [aiIssues, setAiIssues] = useState<ExtractionIssue[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [tableExpanded, setTableExpanded] = useState(false);
  const [exportingPdf, setExportingPdf] = useState<PdfOrientation | null>(null);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [docxExportError, setDocxExportError] = useState("");
  const [uploadKey, setUploadKey] = useState(0);
  const [customTemplate, setCustomTemplate] = useState<CustomTemplate | null>(null);

  useEffect(() => {
    loadTemplate()
      .then((stored) => {
        if (stored) setCustomTemplate(stored);
      })
      .catch(() => {});
  }, []);

  const handleTemplateChange = useCallback((template: CustomTemplate | null) => {
    setCustomTemplate(template);
    if (template) saveTemplate(template).catch(() => {});
    else clearTemplate().catch(() => {});
  }, []);

  const handleFilesChanged = useCallback((files: SourceDocument[]) => setSources(files), []);

  /**
   * Reads the documents offline first. The model is only called for the parts
   * the reader genuinely cannot see: pages with no text layer, or a table it
   * could not recognise at all.
   */
  const handleProcess = async () => {
    if (sources.length === 0) return;
    setAppState("loading");
    setErrorMsg("");
    setAiIssues([]);

    try {
      const documents = await readDocuments(sources);
      let extraction = analyze(documents);

      const scans = sources.filter((s, i) => documents[i]?.isScanned || s.kind === "image");
      const needsVision = extraction.rows.length === 0 && scans.length > 0;
      const needsTextRescue =
        extraction.rows.length === 0 && scans.length === 0 && documents.some((d) => d.plainText.trim());

      if ((needsVision || needsTextRescue) && !apiKey) {
        throw new Error(
          needsVision
            ? "El documento es una imagen o un escaneo sin texto. Configura una clave de OpenAI para poder leerlo."
            : "No se ha reconocido ninguna tabla en el documento. Configura una clave de OpenAI para intentar leerlo con IA."
        );
      }

      if (needsVision) {
        const response = await aiReadScan(scans, apiKey);
        extraction = { ...extraction, ...fromAiResponse(response, "ai-vision") } as ExtractionResult;
      } else if (needsTextRescue) {
        const response = await aiReadText(documents, apiKey);
        extraction = { ...extraction, ...fromAiResponse(response, "ai-text") } as ExtractionResult;
      }

      setResult(extraction);
      setMeta(extraction.meta);
      setTableRows(extraction.rows);
      setAppState(extraction.rows.length > 0 ? "done" : "error");
      if (extraction.rows.length === 0) {
        setErrorMsg("No se han encontrado líneas de artículo en los documentos cargados.");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error desconocido.");
      setAppState("error");
    }
  };

  const handleVerify = async () => {
    if (!result || !apiKey) return;
    setIsVerifying(true);
    setAiIssues([]);
    try {
      const verification = await aiVerify(tableRows, result.documents, apiKey);
      setAiIssues(verificationToIssues(verification));
    } catch (e) {
      setAiIssues([
        { level: "error", message: e instanceof Error ? e.message : "No se ha podido verificar con IA." },
      ]);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = () => {
    setSources([]);
    setTableRows([]);
    setMeta(EMPTY_META);
    setResult(null);
    setAiIssues([]);
    setAppState("idle");
    setErrorMsg("");
    setUploadKey((k) => k + 1);
  };

  const handleRestoreSession = useCallback((rows: TableRow[], restoredMeta: InvoiceMeta) => {
    setTableRows(rows.map((row) => normalizeRow(row)));
    setMeta(normalizeMeta(restoredMeta));
    setResult(null);
    setAiIssues([]);
    setAppState("done");
    setErrorMsg("");
  }, []);

  const handleExportPdf = async (orientation: PdfOrientation) => {
    setExportingPdf(orientation);
    try {
      await exportPackingListPdf(tableRows, meta, orientation);
    } finally {
      setExportingPdf(null);
    }
  };

  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    setDocxExportError("");
    try {
      await exportPackingListDocx(tableRows, meta);
    } catch (e) {
      setDocxExportError(e instanceof Error ? e.message : "Error al generar el DOCX.");
    } finally {
      setIsExportingDocx(false);
    }
  };

  const totalM2 = tableRows.reduce((s, r) => s + r.m2, 0);
  const totalCajas = tableRows.reduce((s, r) => s + r.cajas, 0);
  const totalPesoNeto = tableRows.reduce((s, r) => s + r.peso_neto, 0);
  const totalPesoBruto = tableRows.reduce((s, r) => s + r.peso_bruto, 0);
  const hasData = tableRows.length > 0;
  const hasMultipleFiles = sources.length > 1;
  const duplicateRoles = new Set(sources.map((s) => s.role)).size !== sources.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NEXORA Brand Header */}
      <header className="bg-foreground text-white border-b border-white/10">
        <div className="max-w-screen-2xl mx-auto px-8 py-5 flex items-center justify-between">
          <div>
            <h1
              className="text-white font-display font-semibold tracking-display uppercase leading-none"
              style={{ fontSize: "1.35rem", letterSpacing: "0.25em" }}
            >
              NEXORA
            </h1>
            <p
              className="mt-1 uppercase font-display font-medium"
              style={{ fontSize: "0.58rem", letterSpacing: "0.18em", color: GOLD }}
            >
              Generador de Packing Lists
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            <span className="font-display" style={{ letterSpacing: "0.06em" }}>B24881047</span>
            <span style={{ color: GOLD }}>·</span>
            <span>info@nexoraceramica.es</span>
          </div>
        </div>
      </header>

      <div style={{ height: "2px", background: GOLD }} />

      <main className="max-w-screen-2xl mx-auto px-8 py-8 space-y-6">
        <div className={`grid grid-cols-1 gap-6 transition-all duration-300 ${tableExpanded ? "" : "lg:grid-cols-3"}`}>
          {/* ── LEFT SIDEBAR ── */}
          <div className={`space-y-4 ${tableExpanded ? "hidden" : "lg:col-span-1"}`}>
            {/* Step 1 — Upload */}
            <div className="border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center justify-center font-display font-semibold text-white text-xs"
                  style={{ width: "22px", height: "22px", background: GOLD, flexShrink: 0 }}
                >
                  1
                </span>
                <div>
                  <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-widest-plus">
                    Cargar Documentos
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Factura, packing list, o ambos juntos</p>
                </div>
              </div>

              <UploadZone key={uploadKey} onFilesChanged={handleFilesChanged} disabled={appState === "loading"} />

              <Button
                className="w-full font-display font-medium tracking-widest-plus uppercase text-xs"
                onClick={handleProcess}
                disabled={sources.length === 0 || appState === "loading" || duplicateRoles}
                style={{ letterSpacing: "0.12em" }}
              >
                {appState === "loading" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Leyendo documentos...
                  </>
                ) : (
                  <>
                    Extraer datos
                    {sources.length > 1 && (
                      <span className="ml-2 bg-white/20 text-xs px-1.5 py-0.5" style={{ letterSpacing: "0" }}>
                        {sources.length}
                      </span>
                    )}
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                La lectura se hace en tu navegador, sin IA. Solo se recurre a OpenAI si el archivo es una foto o un
                escaneo sin texto, o si pides una verificación.
              </p>

              {appState === "error" && (
                <div className="border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {appState === "done" && (
                <div
                  className="p-3 text-xs flex items-center gap-2"
                  style={{
                    background: "hsl(142 50% 42% / 0.08)",
                    border: "1px solid hsl(142 50% 42% / 0.25)",
                    color: "hsl(142 50% 32%)",
                  }}
                >
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Datos extraídos{hasMultipleFiles ? " de todos los documentos" : ""}. Revisa la tabla.</span>
                </div>
              )}
            </div>

            {/* Step 2 — Export */}
            {hasData && (
              <div className="border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <span
                    className="flex items-center justify-center font-display font-semibold text-white text-xs"
                    style={{ width: "22px", height: "22px", background: GOLD, flexShrink: 0 }}
                  >
                    2
                  </span>
                  <div>
                    <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-widest-plus">
                      Generar Packing List
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Modelo oficial NEXORA</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    className="w-full justify-start gap-2 text-xs font-medium uppercase"
                    style={{ letterSpacing: "0.08em" }}
                    onClick={() => handleExportPdf("portrait")}
                    disabled={exportingPdf !== null}
                  >
                    {exportingPdf === "portrait" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5" />
                    )}
                    Generar PDF · Vertical
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-xs font-medium uppercase"
                    style={{ letterSpacing: "0.08em" }}
                    onClick={() => handleExportPdf("landscape")}
                    disabled={exportingPdf !== null}
                  >
                    {exportingPdf === "landscape" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5" />
                    )}
                    Generar PDF · Horizontal
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-xs font-medium uppercase"
                    style={{ letterSpacing: "0.08em" }}
                    onClick={handleExportDocx}
                    disabled={isExportingDocx}
                  >
                    {isExportingDocx ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    Packing List (DOCX)
                  </Button>

                  {docxExportError && (
                    <div className="border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{docxExportError}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleReset}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5 pt-1 font-display uppercase"
                  style={{ letterSpacing: "0.1em" }}
                >
                  <RefreshCw className="w-3 h-3" />
                  Reiniciar
                </button>
              </div>
            )}

            <SessionsPanel tableRows={tableRows} meta={meta} onRestoreSession={handleRestoreSession} />

            <SettingsPanel onApiKeyChange={setApiKey} />

            <TemplateUploadPanel onTemplateChange={handleTemplateChange} currentTemplate={customTemplate} />
          </div>

          {/* ── MAIN CONTENT ── */}
          <div className={`space-y-5 ${tableExpanded ? "" : "lg:col-span-2"}`}>
            {result && (
              <ExtractionReport
                result={result}
                hasApiKey={Boolean(apiKey)}
                isVerifying={isVerifying}
                onVerify={handleVerify}
                aiIssues={aiIssues}
              />
            )}

            {result && result.confidence < LOW_CONFIDENCE && result.rows.length > 0 && (
              <div className="border p-3 text-xs flex items-start gap-2" style={{ borderColor: GOLD, background: "hsl(38 57% 54% / 0.07)" }}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD }} />
                <span>
                  El documento se ha entendido solo parcialmente. Revisa la tabla con atención antes de generar el
                  packing list{apiKey ? ", o lanza una verificación con IA." : "."}
                </span>
              </div>
            )}

            {/* Expedition metadata */}
            {hasData && (
              <div className="border border-border bg-card p-5 shadow-sm">
                <h3
                  className="text-xs font-display font-semibold text-muted-foreground uppercase mb-4"
                  style={{ letterSpacing: "0.16em" }}
                >
                  Datos de la Expedición
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                  {META_FIELDS.map(({ label, key, wide }) => (
                    <div key={key} className={wide ? "col-span-2 md:col-span-3" : ""}>
                      <p
                        className="text-xs text-muted-foreground font-display uppercase mb-1"
                        style={{ letterSpacing: "0.1em" }}
                      >
                        {label}
                      </p>
                      {key === "familia_leyenda" ? (
                        <textarea
                          rows={2}
                          className="text-sm font-semibold text-foreground w-full bg-transparent border-b border-transparent hover:border-border focus:border-foreground focus:outline-none py-0.5 transition-colors resize-none"
                          value={meta[key]}
                          onChange={(e) => setMeta((m) => ({ ...m, [key]: e.target.value }))}
                        />
                      ) : (
                        <input
                          className="text-sm font-semibold text-foreground w-full bg-transparent border-b border-transparent hover:border-border focus:border-foreground focus:outline-none py-0.5 transition-colors"
                          value={meta[key]}
                          onChange={(e) => setMeta((m) => ({ ...m, [key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats row */}
            {hasData && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total M²", value: fmtNum(totalM2), unit: "m²" },
                  { label: "Total Cajas", value: fmtNum(totalCajas), unit: "" },
                  { label: "Peso Neto", value: fmtNum(totalPesoNeto), unit: "kg" },
                  { label: "Peso Bruto", value: fmtNum(totalPesoBruto), unit: "kg" },
                ].map((stat) => (
                  <div key={stat.label} className="border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground font-display uppercase" style={{ letterSpacing: "0.1em" }}>
                      {stat.label}
                    </p>
                    <p className="text-2xl font-semibold text-foreground mt-1.5 font-display">
                      {stat.value}
                      {stat.unit && (
                        <span
                          className="text-sm font-normal text-muted-foreground ml-1.5"
                          style={{ fontFamily: "var(--app-font-sans)" }}
                        >
                          {stat.unit}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Packing table */}
            <div className="border border-border bg-card shadow-sm">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="text-xs font-display font-semibold text-foreground uppercase" style={{ letterSpacing: "0.16em" }}>
                  Líneas del Packing List
                  {hasData && (
                    <span
                      className="ml-2 font-normal text-muted-foreground"
                      style={{ letterSpacing: "0", fontFamily: "var(--app-font-sans)" }}
                    >
                      ({tableRows.length} {tableRows.length === 1 ? "artículo" : "artículos"})
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setTableExpanded((v) => !v)}
                  title={tableExpanded ? "Reducir tabla" : "Expandir tabla"}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-display uppercase"
                  style={{ letterSpacing: "0.1em" }}
                >
                  {tableExpanded ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      Reducir
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      Expandir
                    </>
                  )}
                </button>
              </div>
              <div className="p-0">
                <PackingTable
                  data={tableRows}
                  onChange={setTableRows}
                  showSourceFile={hasMultipleFiles}
                  sourceFileNames={sources.map((f) => f.filename)}
                  sourceFileRoles={Object.fromEntries(sources.map((f) => [f.filename, f.role]))}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-16 border-t border-border py-6">
        <div className="max-w-screen-2xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground font-display uppercase" style={{ letterSpacing: "0.14em" }}>
            NEXORA CERAMICA S.L.
          </p>
          <p className="text-xs text-muted-foreground">
            B24881047 · Av. del Mediterráneo, 87, Nave 3, Onda · info@nexoraceramica.es
          </p>
          <p className="text-xs text-muted-foreground opacity-50">Plataforma interna de automatización logística</p>
        </div>
      </footer>
    </div>
  );
}
