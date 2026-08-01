/**
 * Deterministic extraction pipeline — the default path of the application.
 *
 *   read (pdf.js / DOCX xml)  →  lines  →  column bands  →  rows  →  verify
 *
 * No network call happens anywhere in here. The AI is only reached for the two
 * cases this cannot cover — a scanned page with no text layer, and an explicit
 * verification request — both of which live in `services/aiService.ts`.
 */

import type { InvoiceMeta, TableRow } from "@/types/packing";
import { EMPTY_META } from "@/types/packing";
import { buildRows } from "./buildRows";
import { matchField } from "./fields";
import { groupIntoLines } from "./lines";
import { extractMeta } from "./metaFields";
import { detectNumberLocale, type NumberLocale } from "./numbers";
import { readDocx } from "./readDocx";
import { readPdf } from "./readPdf";
import { scanTable, type TableScan } from "./table";
import type {
  DeclaredTotals,
  DocumentText,
  ExtractionIssue,
  ExtractionResult,
  SourceDocument,
  TextItem,
} from "./types";
import { computeConfidence, verifyRows, verifyTotals } from "./validate";

export * from "./types";
export { readPdf } from "./readPdf";
export { readDocx } from "./readDocx";
export { sumRows, verifyTotals } from "./validate";
export { fmtNum, fmtInt } from "./numbers";

/** Meta fields that count towards the "how much did we understand" score. */
const SCORED_META: (keyof InvoiceMeta)[] = [
  "invoice_reference",
  "invoice_date",
  "client_name",
  "client_vat",
  "client_address",
  "contenedor",
];

export async function readDocuments(sources: SourceDocument[]): Promise<DocumentText[]> {
  const documents: DocumentText[] = [];
  for (const source of sources) {
    documents.push(await readSource(source));
  }
  return documents;
}

async function readSource(source: SourceDocument): Promise<DocumentText> {
  switch (source.kind) {
    case "pdf":
      return readPdf(source);
    case "docx":
      return readDocx(source);
    case "text":
      return readPlainText(source);
    case "image":
    default:
      return {
        filename: source.filename,
        role: source.role,
        kind: source.kind,
        pages: [],
        plainText: "",
        nativeTables: [],
        isScanned: true,
      };
  }
}

function readPlainText(source: SourceDocument): DocumentText {
  const text = new TextDecoder().decode(source.bytes);
  const items: TextItem[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    let cursor = 0;
    line.split(/\t|\s{2,}/).forEach((cellText) => {
      const trimmed = cellText.trim();
      if (trimmed) items.push({ text: trimmed, x: cursor, y: index * 12, width: trimmed.length * 4, height: 10 });
      cursor += Math.max(cellText.length, 1) * 4 + 8;
    });
  });
  return {
    filename: source.filename,
    role: source.role,
    kind: "text",
    pages: [{ pageNumber: 1, width: 595, height: 842, items, lines: groupIntoLines(items, 1) }],
    plainText: text,
    nativeTables: [],
    isScanned: text.trim().length < 40,
  };
}

/**
 * Runs the whole pipeline over already-read documents. Kept separate from
 * `extract` so the UI can read once and re-run the analysis cheaply.
 */
export function analyze(documents: DocumentText[]): ExtractionResult {
  const issues: ExtractionIssue[] = [];
  const meta = documents.length ? extractMeta(documents) : { ...EMPTY_META };

  const rows: TableRow[] = [];
  const declaredTotals: DeclaredTotals = {};
  const detectedColumns: string[] = [];
  let method: ExtractionResult["method"] = "none";

  for (const doc of documents) {
    if (doc.isScanned) {
      issues.push({
        level: "warning",
        message: `"${doc.filename}" no contiene texto seleccionable (es un escaneo o una foto). Necesita la verificación con IA para leerse.`,
      });
      continue;
    }

    const locale = detectNumberLocale(doc.plainText);
    const scan = scanForDocument(doc, locale);
    if (!scan || scan.columns.length === 0) {
      issues.push({
        level: "warning",
        message: `No se ha reconocido ninguna tabla de artículos en "${doc.filename}".`,
      });
      continue;
    }

    scan.columns.forEach((c) => {
      if (!detectedColumns.includes(c.label)) detectedColumns.push(c.label);
    });
    Object.entries(scan.declaredTotals).forEach(([key, value]) => {
      const typedKey = key as keyof DeclaredTotals;
      if (value !== undefined && declaredTotals[typedKey] === undefined) declaredTotals[typedKey] = value;
    });

    const built = buildRows(scan, locale, doc.filename);
    issues.push(...built.issues);
    rows.push(...built.rows);
    method = doc.nativeTables.length > 0 ? "docx-table" : "layout";
  }

  const deduped = dedupe(rows);
  if (deduped.length !== rows.length) {
    issues.push({
      level: "info",
      message: `Se han unificado ${rows.length - deduped.length} líneas repetidas entre documentos.`,
    });
  }

  const report = verifyTotals(deduped, declaredTotals);
  issues.push(...report.issues);
  issues.push(...verifyRows(deduped));

  if (report.hadReference && report.mismatched.length === 0) {
    issues.push({
      level: "info",
      message: `Totales verificados contra el documento (${report.matched.join(", ")}). No hace falta IA.`,
    });
  }

  const metaFilled = SCORED_META.filter((k) => meta[k].trim().length > 0).length;

  return {
    meta,
    rows: deduped,
    method: deduped.length ? method : "none",
    confidence: computeConfidence({
      columnCount: detectedColumns.length,
      rowCount: deduped.length,
      report,
      metaFilled,
      metaTotal: SCORED_META.length,
    }),
    issues,
    detectedColumns,
    declaredTotals,
    documents,
  };
}

/** Reads the given files and analyses them in one step. */
export async function extract(sources: SourceDocument[]): Promise<ExtractionResult> {
  return analyze(await readDocuments(sources));
}

/**
 * DOCX tables come back already structured, so they are converted directly;
 * everything else goes through the geometric reconstruction.
 */
function scanForDocument(doc: DocumentText, locale: NumberLocale): TableScan | null {
  if (doc.nativeTables.length > 0) {
    const fromTables = scanNativeTables(doc, locale);
    if (fromTables && fromTables.rows.length > 0) return fromTables;
  }
  return scanTable(doc.pages, locale);
}

/** Maps a real DOCX table onto column bands by treating cell index as position. */
function scanNativeTables(doc: DocumentText, locale: NumberLocale): TableScan | null {
  for (const table of doc.nativeTables) {
    if (table.length < 2) continue;

    let headerIndex = -1;
    let headerKeys: (ReturnType<typeof matchField>)[] = [];
    for (let i = 0; i < Math.min(table.length, 5); i++) {
      const keys = table[i].map((cell) => matchField(cell));
      const hits = new Set(keys.filter(Boolean)).size;
      if (hits >= 4 && hits > new Set(headerKeys.filter(Boolean)).size) {
        headerIndex = i;
        headerKeys = keys;
      }
    }
    if (headerIndex < 0) continue;

    // Cell index doubles as the x coordinate, one unit apart.
    const items: TextItem[] = [];
    for (let r = headerIndex; r < table.length; r++) {
      table[r].forEach((cell, c) => {
        const text = cell.trim();
        if (text) items.push({ text, x: c * 100, y: (r - headerIndex) * 12, width: 90, height: 10 });
      });
    }

    const scan = scanTable(
      [
        {
          pageNumber: 1,
          width: table[headerIndex].length * 100,
          height: (table.length - headerIndex) * 12,
          items,
          lines: groupIntoLines(items, 1),
        },
      ],
      locale
    );
    if (scan.rows.length > 0) return scan;
  }
  return null;
}

/** Drops lines that appear identically in more than one uploaded document. */
function dedupe(rows: TableRow[]): TableRow[] {
  const seen = new Map<string, TableRow>();
  for (const row of rows) {
    const key = [
      row.contenedor,
      row.formato,
      row.modelo,
      row.color,
      row.tono,
      row.m2.toFixed(2),
      row.piezas,
      row.peso_neto.toFixed(2),
    ]
      .join("|")
      .toUpperCase();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, row);
    } else if (!existing.precinto && row.precinto) {
      existing.precinto = row.precinto;
    }
  }
  return [...seen.values()];
}
