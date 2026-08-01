/**
 * Self-verification.
 *
 * Packing lists print their own totals, which gives the pipeline a free check:
 * if our sums match the document's footer, the extraction is right and no model
 * needs to look at it. When they disagree we say exactly which column is off —
 * that is the one case where asking the AI to re-read is worth the call.
 */

import type { TableRow } from "@/types/packing";
import { fmtNum } from "./numbers";
import type { DeclaredTotals, ExtractionIssue } from "./types";

/** Relative tolerance when comparing our sums against the document's footer. */
const TOLERANCE = 0.005;

export interface RowTotals {
  nro_palets: number;
  m2: number;
  piezas: number;
  cajas: number;
  peso_neto: number;
  peso_bruto: number;
  contenedores: number;
}

export function sumRows(rows: TableRow[]): RowTotals {
  const containers = new Set(rows.map((r) => r.contenedor.trim()).filter(Boolean));
  return {
    nro_palets: rows.reduce((s, r) => s + r.nro_palets, 0),
    m2: rows.reduce((s, r) => s + r.m2, 0),
    piezas: rows.reduce((s, r) => s + r.piezas, 0),
    cajas: rows.reduce((s, r) => s + r.cajas, 0),
    peso_neto: rows.reduce((s, r) => s + r.peso_neto, 0),
    peso_bruto: rows.reduce((s, r) => s + r.peso_bruto, 0),
    contenedores: containers.size,
  };
}

const CHECKS: { key: keyof DeclaredTotals & keyof RowTotals; label: string; decimals: number }[] = [
  { key: "nro_palets", label: "Nro. palets", decimals: 0 },
  { key: "m2", label: "M2", decimals: 2 },
  { key: "piezas", label: "Piezas", decimals: 0 },
  { key: "cajas", label: "Cajas", decimals: 0 },
  { key: "peso_neto", label: "Peso neto", decimals: 2 },
  { key: "peso_bruto", label: "Peso bruto", decimals: 2 },
];

export interface VerificationReport {
  issues: ExtractionIssue[];
  /** Columns whose sum matched what the document declares. */
  matched: string[];
  /** Columns whose sum did not match. */
  mismatched: string[];
  /** True when the document declared totals we could compare against. */
  hadReference: boolean;
}

export function verifyTotals(rows: TableRow[], declared: DeclaredTotals): VerificationReport {
  const sums = sumRows(rows);
  const issues: ExtractionIssue[] = [];
  const matched: string[] = [];
  const mismatched: string[] = [];

  for (const check of CHECKS) {
    const expected = declared[check.key];
    if (expected === undefined || expected === 0) continue;
    const actual = sums[check.key];
    const delta = Math.abs(actual - expected);
    if (delta <= Math.max(expected * TOLERANCE, check.decimals === 0 ? 0.5 : 0.02)) {
      matched.push(check.label);
    } else {
      mismatched.push(check.label);
      issues.push({
        level: "warning",
        field: check.key,
        message: `${check.label}: el documento declara ${fmtNum(expected, check.decimals)} y la suma de las líneas da ${fmtNum(actual, check.decimals)}.`,
      });
    }
  }

  return { issues, matched, mismatched, hadReference: matched.length + mismatched.length > 0 };
}

/** Flags rows whose own numbers are internally inconsistent. */
export function verifyRows(rows: TableRow[]): ExtractionIssue[] {
  const issues: ExtractionIssue[] = [];
  rows.forEach((row, index) => {
    const label = `Línea ${index + 1}${row.modelo ? ` (${row.modelo})` : ""}`;
    if (row.peso_bruto > 0 && row.peso_neto > 0 && row.peso_bruto < row.peso_neto) {
      issues.push({
        level: "warning",
        field: "peso_bruto",
        message: `${label}: el peso bruto es menor que el neto.`,
      });
    }
    if (row.m2 === 0 && row.piezas === 0 && row.cajas === 0) {
      issues.push({
        level: "warning",
        field: "m2",
        message: `${label}: sin cantidades (m2, piezas ni cajas).`,
      });
    }
  });
  return issues;
}

export function computeConfidence(args: {
  columnCount: number;
  rowCount: number;
  report: VerificationReport;
  metaFilled: number;
  metaTotal: number;
}): number {
  const { columnCount, rowCount, report, metaFilled, metaTotal } = args;
  if (rowCount === 0) return 0;

  let score = 0.3;
  score += Math.min(columnCount / 10, 1) * 0.25;
  score += Math.min(metaFilled / Math.max(metaTotal, 1), 1) * 0.15;

  if (report.hadReference) {
    const ratio = report.matched.length / (report.matched.length + report.mismatched.length);
    score += ratio * 0.3;
    // A column that disagrees with the document's own total is hard evidence
    // that something was misread, so it costs more than a match earns.
    score -= Math.min(report.mismatched.length * 0.12, 0.4);
  } else {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}
