import React, { useState, useCallback, useEffect } from "react";
import { Download, Loader2, AlertCircle, CheckCircle, RefreshCw, FileDown, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsPanel } from "@/components/SettingsPanel";
import { UploadZone } from "@/components/UploadZone";
import { PackingTable } from "@/components/PackingTable";
import { SessionsPanel } from "@/components/SessionsPanel";
import { TemplateUploadPanel, type CustomTemplate } from "@/components/TemplateUploadPanel";
import { extractInvoiceData, type PdfFile } from "@/services/openaiService";
import { exportPackingListDocx } from "@/utils/exportDocx";
import { exportPackingListPdf } from "@/utils/exportPdf";
import { saveTemplate, loadTemplate, clearTemplate } from "@/utils/templateStorage";
import type { TableRow, InvoiceMeta } from "@/types/packing";

type AppState = "idle" | "loading" | "done" | "error";

const EMPTY_META: InvoiceMeta = {
  invoice_reference: "",
  invoice_date: "",
  supplier_name: "",
  client_name: "",
  client_vat: "",
  client_address: "",
  contenedor: "",
  precinto: "",
  familia_leyenda: "",
  codigo_cee: "",
  total_contenedores: "1",
};

function toTableRow(item: {
  fam: string;
  formato: string;
  modelo: string;
  color: string;
  cal: string;
  tono: string;
  clbr: string;
  nro_palets: number;
  m2: number;
  piezas: number;
  cajas: number;
  peso_neto: number;
  peso_bruto: number;
  source_file?: string;
}): TableRow {
  return {
    id: `row-${Math.random().toString(36).slice(2)}`,
    fam: item.fam,
    formato: item.formato,
    modelo: item.modelo,
    color: item.color,
    cal: item.cal,
    tono: item.tono,
    clbr: item.clbr,
    nro_palets: item.nro_palets,
    m2: item.m2,
    piezas: item.piezas,
    cajas: item.cajas,
    peso_neto: item.peso_neto,
    peso_bruto: item.peso_bruto,
    source_file: item.source_file ?? "",
    custom_fields: {},
  };
}

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
  const [appState, setAppState] = useState<AppState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [meta, setMeta] = useState<InvoiceMeta>(EMPTY_META);
  const [tableExpanded, setTableExpanded] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [docxExportError, setDocxExportError] = useState("");
  const [uploadKey, setUploadKey] = useState(0);
  const [customTemplate, setCustomTemplate] = useState<CustomTemplate | null>(null);

  useEffect(() => {
    loadTemplate().then((stored) => {
      if (stored) setCustomTemplate(stored);
    }).catch(() => {});
  }, []);

  const handleTemplateChange = useCallback((template: CustomTemplate | null) => {
    setCustomTemplate(template);
    if (template) saveTemplate(template).catch(() => {});
    else clearTemplate().catch(() => {});
  }, []);

  const handleFilesChanged = useCallback((files: PdfFile[]) => setPdfFiles(files), []);

  const handleProcess = async () => {
    if (pdfFiles.length === 0) return;
    if (!apiKey) {
      setErrorMsg("Configura tu clave de API OpenAI antes de procesar.");
      setAppState("error");
      return;
    }
    if (pdfFiles.length === 2 && pdfFiles[0].role === pdfFiles[1].role) return;
    setAppState("loading");
    setErrorMsg("");
    try {
      const result = await extractInvoiceData(pdfFiles, apiKey);
      setMeta({
        invoice_reference: result.invoice_reference,
        invoice_date: result.invoice_date,
        supplier_name: result.supplier_name,
        client_name: result.client_name || "",
        client_vat: result.client_vat || "",
        client_address: result.client_address || "",
        contenedor: result.contenedor || "",
        precinto: result.precinto || "",
        familia_leyenda: result.familia_leyenda || "",
        codigo_cee: result.codigo_cee || "",
        total_contenedores: result.total_contenedores || "1",
      });
      setTableRows(result.items.map(toTableRow));
      setAppState("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Error desconocido.");
      setAppState("error");
    }
  };

  const handleReset = () => {
    setPdfFiles([]);
    setTableRows([]);
    setMeta(EMPTY_META);
    setAppState("idle");
    setErrorMsg("");
    setUploadKey((k) => k + 1);
  };

  const handleRestoreSession = useCallback((rows: TableRow[], restoredMeta: InvoiceMeta) => {
    setTableRows(rows);
    setMeta(restoredMeta);
    setAppState("done");
    setErrorMsg("");
  }, []);

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

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportPackingListPdf(tableRows, meta);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const totalM2 = tableRows.reduce((s, r) => s + r.m2, 0);
  const totalPiezas = tableRows.reduce((s, r) => s + r.piezas, 0);
  const totalPesoNeto = tableRows.reduce((s, r) => s + r.peso_neto, 0);
  const totalPesoBruto = tableRows.reduce((s, r) => s + r.peso_bruto, 0);
  const hasData = tableRows.length > 0;
  const hasMultipleFiles = pdfFiles.length > 1;
  const hasDuplicateRoles = pdfFiles.length === 2 && pdfFiles[0].role === pdfFiles[1].role;

  const META_FIELDS: { label: string; key: keyof InvoiceMeta }[] = [
    { label: "Nº Factura", key: "invoice_reference" },
    { label: "Fecha", key: "invoice_date" },
    { label: "Proveedor", key: "supplier_name" },
    { label: "Cliente", key: "client_name" },
    { label: "VAT Cliente", key: "client_vat" },
    { label: "Dirección Destinatario", key: "client_address" },
    { label: "Contenedor", key: "contenedor" },
    { label: "Precinto", key: "precinto" },
    { label: "Leyenda Familias", key: "familia_leyenda" },
    { label: "Código CEE", key: "codigo_cee" },
    { label: "Total Contenedores", key: "total_contenedores" },
  ];

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
              style={{ fontSize: "0.58rem", letterSpacing: "0.18em", color: "hsl(38 57% 54%)" }}
            >
              Generador de Packing Lists
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            <span className="font-display" style={{ letterSpacing: "0.06em" }}>B24881047</span>
            <span style={{ color: "hsl(38 57% 54%)" }}>·</span>
            <span>info@nexoraceramica.es</span>
          </div>
        </div>
      </header>

      <div style={{ height: "2px", background: "hsl(38 57% 54%)" }} />

      <main className="max-w-screen-2xl mx-auto px-8 py-8 space-y-6">
        <div className={`grid grid-cols-1 gap-6 transition-all duration-300 ${tableExpanded ? "" : "lg:grid-cols-3"}`}>

          {/* ── LEFT SIDEBAR ── */}
          <div className={`space-y-4 ${tableExpanded ? "hidden" : "lg:col-span-1"}`}>
            <SettingsPanel onApiKeyChange={setApiKey} />

            <TemplateUploadPanel
              onTemplateChange={handleTemplateChange}
              currentTemplate={customTemplate}
            />

            <SessionsPanel
              tableRows={tableRows}
              meta={meta}
              onRestoreSession={handleRestoreSession}
            />

            {/* Step 1 — Upload */}
            <div className="border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center justify-center font-display font-semibold text-white text-xs"
                  style={{ width: "22px", height: "22px", background: "hsl(38 57% 54%)", letterSpacing: "0", flexShrink: 0 }}
                >
                  1
                </span>
                <div>
                  <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-widest-plus">
                    Cargar Documentos
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Factura, packing list, o ambos juntos
                  </p>
                </div>
              </div>

              <UploadZone
                key={uploadKey}
                onFilesChanged={handleFilesChanged}
                disabled={appState === "loading"}
              />

              <Button
                className="w-full font-display font-medium tracking-widest-plus uppercase text-xs"
                onClick={handleProcess}
                disabled={pdfFiles.length === 0 || !apiKey || appState === "loading" || hasDuplicateRoles}
                style={{ letterSpacing: "0.12em" }}
              >
                {appState === "loading" ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Procesando con IA...</>
                ) : (
                  <>
                    Procesar con IA
                    {pdfFiles.length > 1 && (
                      <span className="ml-2 bg-white/20 text-xs px-1.5 py-0.5" style={{ letterSpacing: "0" }}>
                        {pdfFiles.length} PDFs
                      </span>
                    )}
                  </>
                )}
              </Button>

              {appState === "error" && (
                <div className="border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {appState === "done" && (
                <div className="p-3 text-xs flex items-center gap-2"
                  style={{ background: "hsl(142 50% 42% / 0.08)", border: "1px solid hsl(142 50% 42% / 0.25)", color: "hsl(142 50% 32%)" }}>
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Datos extraídos{hasMultipleFiles ? " de ambos documentos" : ""}. Revisa y edita la tabla.</span>
                </div>
              )}
            </div>

            {/* Step 2 — Export */}
            {hasData && (
              <div className="border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <span
                    className="flex items-center justify-center font-display font-semibold text-white text-xs"
                    style={{ width: "22px", height: "22px", background: "hsl(38 57% 54%)", flexShrink: 0 }}
                  >
                    2
                  </span>
                  <div>
                    <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-widest-plus">
                      Exportar
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Descarga el documento corporativo</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-xs font-medium uppercase"
                    style={{ letterSpacing: "0.08em" }}
                    onClick={handleExportDocx}
                    disabled={isExportingDocx}
                  >
                    {isExportingDocx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Packing List (DOCX)
                  </Button>

                  {docxExportError && (
                    <div className="border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{docxExportError}</span>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-xs font-medium uppercase"
                    style={{ letterSpacing: "0.08em" }}
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                  >
                    {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                    Packing List (PDF)
                  </Button>
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
          </div>

          {/* ── MAIN CONTENT ── */}
          <div className={`space-y-5 ${tableExpanded ? "" : "lg:col-span-2"}`}>

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
                  {META_FIELDS.map(({ label, key }) => (
                    <div key={key} className={key === "client_address" || key === "familia_leyenda" || key === "codigo_cee" ? "col-span-2 md:col-span-3" : ""}>
                      <p className="text-xs text-muted-foreground font-display uppercase mb-1" style={{ letterSpacing: "0.1em" }}>
                        {label}
                      </p>
                      {key === "familia_leyenda" ? (
                        <textarea
                          rows={2}
                          className="text-sm font-semibold text-foreground w-full bg-transparent border-b border-transparent hover:border-border focus:border-foreground focus:outline-none py-0.5 transition-colors resize-none"
                          value={meta[key]}
                          onChange={e => setMeta(m => ({ ...m, [key]: e.target.value }))}
                        />
                      ) : (
                        <input
                          className="text-sm font-semibold text-foreground w-full bg-transparent border-b border-transparent hover:border-border focus:border-foreground focus:outline-none py-0.5 transition-colors"
                          value={meta[key]}
                          onChange={e => setMeta(m => ({ ...m, [key]: e.target.value }))}
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
                  { label: "Total M²", value: totalM2.toFixed(2), unit: "m²" },
                  { label: "Total Piezas", value: String(totalPiezas), unit: "" },
                  { label: "Peso Neto", value: totalPesoNeto.toLocaleString("en-US", { minimumFractionDigits: 2 }), unit: "kg" },
                  { label: "Peso Bruto", value: totalPesoBruto.toLocaleString("en-US", { minimumFractionDigits: 2 }), unit: "kg" },
                ].map((stat) => (
                  <div key={stat.label} className="border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground font-display uppercase" style={{ letterSpacing: "0.1em" }}>
                      {stat.label}
                    </p>
                    <p className="text-2xl font-semibold text-foreground mt-1.5 font-display">
                      {stat.value}
                      {stat.unit && (
                        <span className="text-sm font-normal text-muted-foreground ml-1.5" style={{ fontFamily: "var(--app-font-sans)" }}>
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
                    <span className="ml-2 font-normal text-muted-foreground" style={{ letterSpacing: "0", fontFamily: "var(--app-font-sans)" }}>
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
                    <><Minimize2 className="w-3.5 h-3.5" />Reducir</>
                  ) : (
                    <><Maximize2 className="w-3.5 h-3.5" />Expandir</>
                  )}
                </button>
              </div>
              <div className="p-0">
                <PackingTable
                  data={tableRows}
                  onChange={setTableRows}
                  showSourceFile={hasMultipleFiles}
                  sourceFileNames={pdfFiles.map((f) => f.filename)}
                  sourceFileRoles={Object.fromEntries(pdfFiles.map((f) => [f.filename, f.role]))}
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
          <p className="text-xs text-muted-foreground opacity-50">
            Plataforma interna de automatización logística
          </p>
        </div>
      </footer>
    </div>
  );
}
