/**
 * Turns the raw grid produced by `scanTable` into NEXORA packing-list rows.
 *
 * Anything the source leaves out is recovered with the company's own ceramic
 * conversion rules rather than guessed by a model — and every derivation is
 * reported back so the operator can see what was computed instead of read.
 */

import {
  calcAFrames,
  calcGrossWeight,
  calcNetWeight,
  calcPieces,
  isLargeFormatTile,
} from "@/services/calculationsService";
import { makeRowId, type TableRow } from "@/types/packing";
import type { FieldKey } from "./fields";
import { parseNumber, type NumberLocale } from "./numbers";
import { looksLikeContainerCode, type GroupMarker, type RawRow, type TableScan } from "./table";
import type { ExtractionIssue } from "./types";

const ARTICLE_FAMILY = /^(\d{3})\d*/;

export interface BuildResult {
  rows: TableRow[];
  issues: ExtractionIssue[];
  derivedFields: Set<string>;
}

export function buildRows(scan: TableScan, locale: NumberLocale, sourceFile: string): BuildResult {
  const issues: ExtractionIssue[] = [];
  const derivedFields = new Set<string>();
  const contextByIndex = new Map<number, { contenedor: string; precinto: string }>();
  scan.containerContexts.forEach((ctx) => contextByIndex.set(ctx.rowIndex, ctx));

  // A column the document prints is authoritative even where a cell is blank —
  // a merged or empty cell is not a gap to fill in with a formula.
  const present = new Set(scan.columns.map((c) => c.key));
  const derivable = (key: FieldKey) => !present.has(key);

  let currentContainer = "";
  let currentSeal = "";
  const rows: TableRow[] = [];
  const positions: RawRow[] = [];

  scan.rows.forEach((raw, index) => {
    const banner = contextByIndex.get(index);
    if (banner) {
      currentContainer = banner.contenedor || currentContainer;
      currentSeal = banner.precinto || currentSeal;
    }

    const row = toRow(raw, locale, sourceFile, derivedFields, derivable);
    if (!row) return;

    // A dedicated column beats the banner; the banner beats nothing.
    if (row.contenedor) {
      currentContainer = row.contenedor;
      currentSeal = row.precinto || currentSeal;
    } else {
      row.contenedor = currentContainer;
      if (!row.precinto) row.precinto = currentSeal;
    }

    rows.push(row);
    positions.push(raw);
  });

  if (scan.hasContainerColumn && scan.groupMarkers.length > 0) {
    applyGroupMarkers(rows, positions, scan.groupMarkers);
  }

  if (derivedFields.size > 0) {
    issues.push({
      level: "info",
      message: `Calculado con las reglas de NEXORA (no venía en el documento): ${[...derivedFields].join(", ")}.`,
    });
  }

  return { rows, issues, derivedFields };
}

/** Page and y flattened into one axis, so ordering works across pages. */
const axis = (pageNumber: number, y: number): number => pageNumber * 100_000 + y;

/** Attaches every line to the container block whose merged cell covers it. */
function applyGroupMarkers(rows: TableRow[], positions: RawRow[], markers: GroupMarker[]): void {
  const ordered = [...markers].sort((a, b) => axis(a.pageNumber, a.y) - axis(b.pageNumber, b.y));
  const rowAxes = positions.map((p) => axis(p.pageNumber, p.y));
  const markerAxes = ordered.map((m) => axis(m.pageNumber, m.y));
  const blockOfRow = assignBlocks(rowAxes, markerAxes);

  rows.forEach((row, index) => {
    const marker = ordered[blockOfRow[index]];
    if (!marker) return;
    if (marker.contenedor) row.contenedor = marker.contenedor;
    if (marker.precinto) row.precinto = marker.precinto;
  });

  // A merged gross-weight cell states the whole block's weight once. It belongs
  // to the block, so park it on its first line — the block's sum is what the
  // document prints, and that is what the totals are checked against.
  ordered.forEach((marker, block) => {
    if (!marker.pesoBruto) return;
    const members = rows.filter((_, index) => blockOfRow[index] === block);
    if (members.length === 0) return;
    if (members.some((row) => row.peso_bruto > 0)) return;
    members[0].peso_bruto = marker.pesoBruto;
    if (members[0].peso_neto === 0) members[0].peso_neto = marker.pesoBruto;
  });
}

/**
 * Works out how many lines each merged cell spans.
 *
 * A cell covering rows `a..b` of an evenly spaced grid is printed at their
 * midpoint, so its position encodes the block's extent:
 *
 *   y(m) = yFirst + h · (S(m-1) + S(m) - 1) / 2
 *
 * where `S(m)` counts the lines up to and including block m. Solving for `S(m)`
 * walks the blocks out in one pass. Nearest-marker matching cannot do this:
 * the midpoint of a three-line block sits closer to the next block's cell than
 * that block's own last line does.
 */
function assignBlocks(rowAxes: number[], markerAxes: number[]): number[] {
  const rowCount = rowAxes.length;
  const markerCount = markerAxes.length;
  if (markerCount <= 1 || rowCount === 0) return rowAxes.map(() => 0);
  if (markerCount > rowCount) return nearestBlocks(rowAxes, markerAxes);

  const spacing = medianSpacing(rowAxes);
  if (spacing === null) return nearestBlocks(rowAxes, markerAxes);

  const first = rowAxes[0];
  const boundaries: number[] = [];
  let previous = 0;
  let clamped = 0;
  let lastOwner = 0;

  for (let m = 0; m < markerCount; m++) {
    const lowest = previous + 1;
    if (lowest > rowCount) {
      // More markers than lines left: the rest cannot own anything.
      boundaries.push(rowCount);
      continue;
    }
    const ideal = Math.round((2 * (markerAxes[m] - first)) / spacing + 1 - previous);
    const bounded = Math.min(Math.max(ideal, lowest), rowCount);
    if (bounded !== ideal) clamped += 1;
    boundaries.push(bounded);
    previous = bounded;
    lastOwner = m;
  }

  // Heavy clamping means the grid is not evenly spaced and the model does not
  // hold; fall back to plain proximity rather than trust a bad fit.
  if (clamped > markerCount / 2) return nearestBlocks(rowAxes, markerAxes);
  boundaries[lastOwner] = rowCount;

  const out: number[] = [];
  let block = 0;
  for (let i = 0; i < rowCount; i++) {
    while (block < markerCount - 1 && i >= boundaries[block]) block += 1;
    out.push(block);
  }
  return out;
}

function medianSpacing(rowAxes: number[]): number | null {
  const gaps: number[] = [];
  for (let i = 1; i < rowAxes.length; i++) {
    const gap = rowAxes[i] - rowAxes[i - 1];
    if (gap > 0.5 && gap < 400) gaps.push(gap);
  }
  if (gaps.length === 0) return null;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/** Monotonic nearest-marker matching, used when the grid is irregular. */
function nearestBlocks(rowAxes: number[], markerAxes: number[]): number[] {
  const out: number[] = [];
  let current = 0;
  for (const rowAxis of rowAxes) {
    while (
      current + 1 < markerAxes.length &&
      Math.abs(markerAxes[current + 1] - rowAxis) <= Math.abs(markerAxes[current] - rowAxis)
    ) {
      current += 1;
    }
    out.push(current);
  }
  return out;
}

function toRow(
  raw: RawRow,
  locale: NumberLocale,
  sourceFile: string,
  derived: Set<string>,
  derivable: (key: FieldKey) => boolean
): TableRow | null {
  const text = (key: FieldKey) => (raw.values[key] ?? "").trim();
  const num = (key: FieldKey) => parseNumber(raw.values[key] ?? "", locale);

  const formato = cleanFormat(text("formato"));
  const modelo = text("modelo");
  const color = text("color");
  const contenedor = pickContainer(text("contenedor"));
  const precinto = text("precinto").replace(/^[-–]$/, "");

  // null means the column was blank; 0 means the document printed a zero. Only
  // the first is safe to fill in — overwriting an explicit 0 would invent data.
  const rawPalets = num("nro_palets");
  const rawM2 = num("m2");
  const rawPiezas = num("piezas");
  const rawCajas = num("cajas");
  const rawNeto = num("peso_neto");
  const rawBruto = num("peso_bruto");

  let nro_palets = rawPalets ?? 0;
  const m2 = rawM2 ?? 0;
  let piezas = rawPiezas ?? 0;
  let cajas = rawCajas ?? 0;
  let peso_neto = rawNeto ?? 0;
  let peso_bruto = rawBruto ?? 0;

  // A line with numbers but no product name is a stray total, not an item.
  if (!modelo && !formato && !color) return null;

  const largeFormat = isLargeFormatTile(`${formato} ${modelo}`);

  if (rawPiezas === null && derivable("piezas") && m2 > 0 && largeFormat) {
    piezas = calcPieces(m2);
    derived.add("piezas");
  }
  if (rawCajas === null && derivable("cajas") && piezas > 0 && largeFormat) {
    // Large slabs ship one per crate, so boxes track pieces.
    cajas = piezas;
    derived.add("cajas");
  }
  if (rawPalets === null && derivable("nro_palets") && piezas > 0 && largeFormat) {
    nro_palets = calcAFrames(piezas);
    derived.add("nro. palets");
  }
  if (rawNeto === null && derivable("peso_neto") && piezas > 0 && largeFormat) {
    peso_neto = calcNetWeight(piezas);
    derived.add("peso neto");
  }
  if (rawBruto === null && derivable("peso_bruto") && peso_neto > 0 && nro_palets > 0) {
    peso_bruto = calcGrossWeight(peso_neto, nro_palets);
    derived.add("peso bruto");
  }
  if (rawNeto === null && derivable("peso_neto") && peso_neto === 0 && peso_bruto > 0) {
    peso_neto = peso_bruto;
    derived.add("peso neto");
  }

  return {
    id: makeRowId(),
    fam: text("fam") || familyFrom(text("modelo")),
    formato,
    modelo,
    color,
    cal: text("cal"),
    tono: text("tono"),
    clbr: text("clbr"),
    contenedor,
    precinto,
    nro_palets,
    m2,
    piezas,
    cajas,
    peso_neto,
    peso_bruto,
    source_file: sourceFile,
    custom_fields: {},
  };
}

/** Normalizes "60 X 120" / "60x120cm" to the "60X120" the model expects. */
function cleanFormat(value: string): string {
  const compact = value.replace(/\s+/g, "");
  const match = /^(\d+(?:[.,]\d+)?)[xX×](\d+(?:[.,]\d+)?)(.*)$/.exec(compact);
  if (!match) return value.trim();
  return `${match[1]}X${match[2]}${match[3]}`.toUpperCase();
}

function pickContainer(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return "";
  const token = trimmed.split(/\s+/).find(looksLikeContainerCode);
  return (token ?? trimmed).toUpperCase();
}

function familyFrom(article: string): string {
  const match = ARTICLE_FAMILY.exec(article.trim());
  return match ? match[1] : "";
}
