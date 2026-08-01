/**
 * Table reconstruction.
 *
 * Finds the header row of a document, turns each recognised heading into an
 * x-band, and then reads every subsequent line by dropping its text runs into
 * the band they sit under. This is the step that replaces the vision model:
 * once the bands are known the document is just a grid.
 */

import { FIELD_TYPES, matchField, type FieldKey } from "./fields";
import { centerX, normalizeLabel } from "./lines";
import { parseNumber, type NumberLocale } from "./numbers";
import type { DeclaredTotals, PageText, TextLine } from "./types";

export interface ColumnBand {
  /** null for a heading we do not use — the band still reserves its space. */
  key: FieldKey | null;
  label: string;
  /** Extent of the heading text itself. */
  headX0: number;
  headX1: number;
  /** Extent of the band once neighbours are taken into account. */
  x0: number;
  x1: number;
}

export interface RawRow {
  /** Raw cell text per column; a missing key means the source left it blank. */
  values: Partial<Record<FieldKey, string>>;
  y: number;
  pageNumber: number;
}

/**
 * A container identity read off the grid. Merged cells are drawn once and
 * vertically centred, so a marker's position says which block of lines it
 * covers rather than which line it sits on.
 */
export interface GroupMarker {
  y: number;
  pageNumber: number;
  contenedor: string;
  precinto: string;
  orden: string;
  /** Gross weight printed once for the whole block, when the cell is merged. */
  pesoBruto: number | null;
}

export interface TableScan {
  columns: RecognisedBand[];
  rows: RawRow[];
  declaredTotals: DeclaredTotals;
  /** Container/seal pairs found on banner lines, keyed by the row they precede. */
  containerContexts: { rowIndex: number; contenedor: string; precinto: string }[];
  /** Container identities read from dedicated columns, positioned by y. */
  groupMarkers: GroupMarker[];
  /** True when the table has its own container column. */
  hasContainerColumn: boolean;
}

/** Columns that describe the container block rather than an individual line. */
const GROUP_KEYS: FieldKey[] = ["orden", "contenedor", "precinto", "peso_bruto"];

/** Minimum recognised headings before a line is accepted as the table header. */
const MIN_HEADER_MATCHES = 4;

const TOTAL_LINE = /^\s*(TOTAL|TOTALES|SUMA|SUBTOTAL|TOTAL GENERAL|GRAND TOTAL)\b/i;
const CONTAINER_CODE = /\b([A-Z]{4})[\s-]?(\d{6,7})(?:[/-](\d))?\b/;

export function scanTable(pages: PageText[], locale: NumberLocale): TableScan {
  let columns: ColumnBand[] = [];
  const rows: RawRow[] = [];
  const declaredTotals: DeclaredTotals = {};
  const containerContexts: TableScan["containerContexts"] = [];
  const groupMarkers: GroupMarker[] = [];

  for (const page of pages) {
    const header = findHeader(page.lines);
    if (header) columns = header.columns;
    if (columns.length === 0) continue;

    const startIndex = header ? header.lineIndex + 1 : 0;
    readPage(page, columns, startIndex, locale, rows, declaredTotals, containerContexts, groupMarkers);
  }

  return {
    columns: columns.filter((c) => c.key !== null) as RecognisedBand[],
    rows,
    declaredTotals,
    containerContexts,
    groupMarkers,
    hasContainerColumn: columns.some((c) => c.key === "contenedor"),
  };
}

interface HeaderMatch {
  lineIndex: number;
  columns: ColumnBand[];
  score: number;
}

/**
 * Scores every line (and every pair of consecutive lines, since headings often
 * wrap) and returns the best candidate.
 */
function findHeader(lines: TextLine[]): HeaderMatch | null {
  let best: HeaderMatch | null = null;

  const recognised = (bands: ColumnBand[]) => bands.filter((b) => b.key !== null).length;

  for (let i = 0; i < lines.length; i++) {
    const single = buildColumns([lines[i]]);
    if (recognised(single) > (best?.score ?? 0)) {
      best = { lineIndex: i, columns: single, score: recognised(single) };
    }
    if (i + 1 < lines.length) {
      const pair = buildColumns([lines[i], lines[i + 1]]);
      if (recognised(pair) > (best?.score ?? 0)) {
        best = { lineIndex: i + 1, columns: pair, score: recognised(pair) };
      }
    }
  }

  if (!best || best.score < MIN_HEADER_MATCHES) return null;
  return best;
}

/** A band whose heading we recognised. */
export type RecognisedBand = ColumnBand & { key: FieldKey };

/**
 * Turns heading runs into bands. Runs from stacked header lines that overlap
 * horizontally are treated as one heading ("Gross" over "Weight (kg)").
 */
function buildColumns(lines: TextLine[]): ColumnBand[] {
  interface Pending {
    parts: string[];
    x0: number;
    x1: number;
  }

  const pending: Pending[] = [];
  for (const line of lines) {
    for (const item of line.items) {
      const x0 = item.x;
      const x1 = item.x + item.width;
      const overlapping = pending.find((p) => x0 < p.x1 + 1.5 && x1 > p.x0 - 1.5);
      if (overlapping) {
        overlapping.parts.push(item.text);
        overlapping.x0 = Math.min(overlapping.x0, x0);
        overlapping.x1 = Math.max(overlapping.x1, x1);
      } else {
        pending.push({ parts: [item.text], x0, x1 });
      }
    }
  }

  // Headings we do not use still become bands. Without them the values under a
  // "Length (m)" column would drift into whichever recognised column is nearest
  // and quietly corrupt it.
  const bands: ColumnBand[] = [];
  const used = new Set<FieldKey>();
  for (const group of pending.sort((a, b) => a.x0 - b.x0)) {
    const label = group.parts.join(" ").replace(/\s+/g, " ").trim();
    const matched = matchField(label);
    const key = matched && !used.has(matched) ? matched : null;
    if (key) used.add(key);
    bands.push({ key, label, headX0: group.x0, headX1: group.x1, x0: group.x0, x1: group.x1 });
  }

  return widenBands(bands);
}

/** Grows each heading's extent until it meets its neighbours. */
function widenBands(columns: ColumnBand[]): ColumnBand[] {
  const sorted = [...columns].sort((a, b) => a.headX0 - b.headX0);
  for (let i = 0; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    sorted[i].x0 = prev ? (prev.headX1 + sorted[i].headX0) / 2 : -Infinity;
    sorted[i].x1 = next ? (sorted[i].headX1 + next.headX0) / 2 : Infinity;
  }
  return sorted;
}

function readPage(
  page: PageText,
  columns: ColumnBand[],
  startIndex: number,
  locale: NumberLocale,
  rows: RawRow[],
  declaredTotals: DeclaredTotals,
  containerContexts: TableScan["containerContexts"],
  groupMarkers: GroupMarker[]
): void {
  const keys = columns.map((c) => c.key).filter((k): k is FieldKey => k !== null);
  const numericKeys = keys.filter((k) => FIELD_TYPES[k] === "number");
  const textKeys = keys.filter(
    (k) => FIELD_TYPES[k] === "text" && k !== "orden" && k !== "contenedor" && k !== "precinto"
  );
  let lastRowY: number | null = null;

  const recordMarker = (line: TextLine, cells: Partial<Record<FieldKey, string>>) => {
    // Identifiers always carry digits. Requiring that keeps prose printed below
    // the grid — legends, notes — from being mistaken for a container block.
    const contenedor = identifier(cells.contenedor);
    const precinto = identifier(cells.precinto);
    const orden = identifier(cells.orden);
    if (!contenedor && !precinto && !orden) return;
    groupMarkers.push({
      y: line.y,
      pageNumber: page.pageNumber,
      contenedor,
      precinto,
      orden,
      pesoBruto: parseNumber(cells.peso_bruto ?? "", locale),
    });
  };

  for (let i = startIndex; i < page.lines.length; i++) {
    const line = page.lines[i];
    if (!line.text) continue;

    const cells = assignToBands(line, columns);
    const numericHits = numericKeys.filter((k) => parseNumber(cells[k] ?? "", locale) !== null).length;
    const filled = Object.values(cells).filter((v) => v && v.trim()).length;
    const named = textKeys.some((k) => hasLetters(cells[k] ?? ""));

    // A merged container cell sits on its own baseline between the lines it
    // spans, carrying nothing but the block's identity.
    const onlyGroupColumns =
      filled > 0 && (Object.keys(cells) as FieldKey[]).every((k) => GROUP_KEYS.includes(k));
    if (onlyGroupColumns && !named) {
      recordMarker(line, cells);
      continue;
    }

    // "CONTENEDOR xxx PRECINTO yyy" banners introduce the lines beneath them.
    // The labels themselves never appear inside a data row, so this is safe
    // even when the banner also repeats the container's weights.
    const context = readContainerContext(line.text);
    if (context) {
      containerContexts.push({ rowIndex: rows.length, ...context });
      continue;
    }

    // Totals close the grid: everything past them is legends and customs notes.
    const isLabelledTotal = TOTAL_LINE.test(line.text) && numericHits >= 2;
    const isAnonymousTotal = !named && numericHits >= 3;
    if (isLabelledTotal || isAnonymousTotal) {
      absorbTotals(cells, declaredTotals, locale);
      return;
    }

    // A data row names a product and carries quantities.
    if (named && numericHits >= 2 && filled >= 3) {
      rows.push({ values: cells, y: line.y, pageNumber: page.pageNumber });
      recordMarker(line, cells);
      lastRowY = line.y;
      continue;
    }

    // A description too long for its cell wraps onto the next line.
    const previous = rows[rows.length - 1];
    if (
      numericHits === 0 &&
      filled > 0 &&
      previous !== undefined &&
      previous.pageNumber === page.pageNumber &&
      lastRowY !== null &&
      line.y - lastRowY <= MAX_WRAP_GAP &&
      isContinuation(cells)
    ) {
      appendContinuation(previous, cells);
      lastRowY = line.y;
    }
  }
}

const hasLetters = (value: string): boolean => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(value);

/** Keeps a cell only when it reads as a code: compact and containing digits. */
function identifier(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed || !/\d/.test(trimmed)) return "";
  if (trimmed.split(/\s+/).length > 2) return "";
  return trimmed;
}

/** Drops every run of a line into the band its centre falls in. */
function assignToBands(line: TextLine, columns: ColumnBand[]): Partial<Record<FieldKey, string>> {
  const buckets = new Map<FieldKey, string[]>();
  for (const item of line.items) {
    const cx = centerX(item);
    // Bands span the whole line, so every run lands in exactly one; a run under
    // a heading we do not use is simply dropped.
    const band = columns.find((c) => cx >= c.x0 && cx < c.x1);
    if (!band || band.key === null) continue;
    const list = buckets.get(band.key) ?? [];
    list.push(item.text.trim());
    buckets.set(band.key, list);
  }

  const cells: Partial<Record<FieldKey, string>> = {};
  buckets.forEach((parts, key) => {
    const value = parts.join(" ").replace(/\s+/g, " ").trim();
    if (value) cells[key] = value;
  });
  return cells;
}

/** Only the description columns ever wrap; anything else is a different record. */
const WRAPPABLE: FieldKey[] = ["modelo", "color"];

/** Largest vertical gap that still counts as the same record wrapping. */
const MAX_WRAP_GAP = 16;

function isContinuation(cells: Partial<Record<FieldKey, string>>): boolean {
  const keys = Object.keys(cells) as FieldKey[];
  if (keys.length === 0 || keys.length > 2) return false;
  return keys.every((k) => WRAPPABLE.includes(k));
}

function appendContinuation(row: RawRow, cells: Partial<Record<FieldKey, string>>): void {
  (Object.keys(cells) as FieldKey[]).forEach((key) => {
    const addition = cells[key];
    if (!addition) return;
    row.values[key] = [row.values[key], addition].filter(Boolean).join(" ");
  });
}

function absorbTotals(
  cells: Partial<Record<FieldKey, string>>,
  totals: DeclaredTotals,
  locale: NumberLocale
): void {
  const assign = (key: keyof DeclaredTotals, field: FieldKey) => {
    const value = parseNumber(cells[field] ?? "", locale);
    // Documents repeat the total line; the first one wins.
    if (value !== null && totals[key] === undefined) totals[key] = value;
  };
  assign("nro_palets", "nro_palets");
  assign("m2", "m2");
  assign("piezas", "piezas");
  assign("cajas", "cajas");
  assign("peso_neto", "peso_neto");
  assign("peso_bruto", "peso_bruto");
}

/** Reads a "CONTENEDOR xxx PRECINTO yyy" banner that introduces a group of lines. */
export function readContainerContext(text: string): { contenedor: string; precinto: string } | null {
  const normalized = normalizeLabel(text);
  const hasContainerLabel = /\b(CONTENEDOR|CONTAINER|CNTR)\b/.test(normalized);
  const hasSealLabel = /\b(PRECINTO|SEAL|SELLO)\b/.test(normalized);
  if (!hasContainerLabel && !hasSealLabel) return null;

  const contenedor = extractLabelled(text, /(?:CONTENEDOR|CONTAINER|CNTR)\.?\s*(?:N[ºO°]?\.?)?\s*[:\s]\s*/i);
  const precinto = extractLabelled(text, /(?:PRECINTO|SEAL|SELLO)\.?\s*(?:N[ºO°]?\.?)?\s*[:\s]\s*/i);
  if (!contenedor && !precinto) return null;
  return { contenedor, precinto };
}

function extractLabelled(text: string, labelPattern: RegExp): string {
  const match = labelPattern.exec(text);
  if (!match) return "";
  const rest = text.slice(match.index + match[0].length).trim();
  const token = rest.split(/\s{2,}|\s(?=[A-ZÁÉÍÓÚÑ]{4,}\s)|\t/)[0]?.trim() ?? "";
  const firstWord = (token.split(/\s+/)[0] ?? "").replace(/[,;]+$/, "");
  // Container and seal numbers always carry digits; a bare word here means we
  // are reading a column heading, not a value.
  return /\d/.test(firstWord) ? firstWord : "";
}

/** True when a token looks like an ISO 6346 container number. */
export function looksLikeContainerCode(value: string): boolean {
  return CONTAINER_CODE.test(value.toUpperCase());
}
