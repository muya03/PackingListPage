/**
 * Shared shapes for the deterministic (AI-free) extraction pipeline.
 *
 * The pipeline turns a source document into positioned text, then into lines,
 * then into a table. Every stage is pure and testable; no network involved.
 */

import type { InvoiceMeta, TableRow } from "@/types/packing";

export type SourceKind = "pdf" | "docx" | "image" | "text";

/** A file handed to the pipeline by the UI. */
export interface SourceDocument {
  filename: string;
  /** Free-form label the user assigned ("Factura Comercial", "Packing List"…). */
  role: string;
  kind: SourceKind;
  /** Raw bytes — used by the PDF and DOCX readers. */
  bytes: ArrayBuffer;
  /** Base64 payload, only kept for the AI fallback on scans/images. */
  base64: string;
}

/** One positioned run of text on a page. */
export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Text items that share a baseline, left-to-right. */
export interface TextLine {
  y: number;
  items: TextItem[];
  /** Items joined with single spaces — convenient for regex work. */
  text: string;
}

/** A page's worth of positioned text, plus its geometry. */
export interface PageText {
  pageNumber: number;
  width: number;
  height: number;
  items: TextItem[];
  lines: TextLine[];
}

/** What a reader returns for one document. */
export interface DocumentText {
  filename: string;
  role: string;
  kind: SourceKind;
  pages: PageText[];
  /** Whole-document plain text, page-ordered. */
  plainText: string;
  /**
   * Tables recovered structurally (DOCX only). When present these are far more
   * reliable than the geometric reconstruction and are used first.
   */
  nativeTables: string[][][];
  /** True when the file carries no usable text layer (a scan). */
  isScanned: boolean;
}

export type IssueLevel = "info" | "warning" | "error";

export interface ExtractionIssue {
  level: IssueLevel;
  message: string;
  /** Field or column the issue refers to, when applicable. */
  field?: string;
}

export type ExtractionMethod = "layout" | "docx-table" | "ai-text" | "ai-vision" | "none";

export interface ExtractionResult {
  meta: InvoiceMeta;
  rows: TableRow[];
  /** How the line items were obtained. */
  method: ExtractionMethod;
  /** 0–1 heuristic: how much of the document we understood. */
  confidence: number;
  issues: ExtractionIssue[];
  /** Column headers detected in the source, in source order. */
  detectedColumns: string[];
  /** Totals the document itself declares, when found — used for verification. */
  declaredTotals: DeclaredTotals;
  /** Plain text per file, kept for an optional AI verification pass. */
  documents: DocumentText[];
}

export interface DeclaredTotals {
  nro_palets?: number;
  m2?: number;
  piezas?: number;
  cajas?: number;
  peso_neto?: number;
  peso_bruto?: number;
  contenedores?: number;
}
