/**
 * Header metadata extraction.
 *
 * Everything above the line-item grid — invoice number, buyer, VAT, container,
 * customs code — is written as "LABEL value" or as a label with its value in
 * the cell underneath. Both shapes are recoverable with the label dictionary
 * plus the run coordinates we already have, so no model is needed here either.
 */

import type { InvoiceMeta } from "@/types/packing";
import { EMPTY_META } from "@/types/packing";
import { matchField } from "./fields";
import { normalizeLabel } from "./lines";
import { readContainerContext } from "./table";
import type { DocumentText, PageText, TextLine } from "./types";

type MetaKey = keyof InvoiceMeta;

interface LabelSpec {
  key: MetaKey;
  labels: string[];
  /** Rejects values that clearly belong to another field. */
  validate?: (value: string) => boolean;
  /** Cleans the captured value. */
  clean?: (value: string) => string;
  /** Last-resort line patterns, tried when no label matched. */
  patterns?: RegExp[];
}

const DATE = /\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/;
const VAT_VALUE = /\b([A-Z]{0,2}[\dA-Z][\d.\- ]{5,17}[\dA-Z])\b/;
const CEE_CODE = /\b(\d{4}[.\s]?\d{2}[.\s]?\d{2}|\d{8})\b/;

const LABEL_SPECS: LabelSpec[] = [
  {
    key: "invoice_reference",
    labels: ["NUMERO FACTURA", "N FACTURA", "FACTURA N", "NUM FACTURA", "INVOICE NO", "INVOICE NUMBER", "INVOICE", "FACTURA", "N INVOICE"],
    validate: (v) => v.length >= 3 && /[\d]/.test(v),
    // "Nº: 000388/61" — the ordinal marker belongs to the label, not the value.
    clean: (v) => v.replace(/^N[ºo°]\.?\s*:?\s*/i, "").trim(),
    // NEXORA's own model prints the reference as "Nº: INV/2026/00013".
    patterns: [/\bN[ºo°]\.?\s*:\s*([A-Z0-9][A-Z0-9/._-]{2,})/i],
  },
  {
    key: "invoice_date",
    labels: ["FECHA FACTURA", "FECHA DE FACTURA", "INVOICE DATE", "FECHA", "DATE"],
    validate: (v) => DATE.test(v),
    clean: (v) => DATE.exec(v)?.[1] ?? v,
  },
  {
    key: "client_name",
    labels: ["CLIENTE", "CLIENT", "COMPRADOR", "BUYER", "CUSTOMER", "SOLD TO"],
    validate: (v) => v.length >= 3 && /[A-Za-zÁÉÍÓÚÑ]{3}/.test(v),
  },
  {
    key: "client_vat",
    labels: ["V A T", "VAT", "VAT NO", "C I F", "CIF", "N I F", "NIF", "TAX ID", "VAT NUMBER"],
    validate: (v) => VAT_VALUE.test(v.toUpperCase()),
    clean: (v) => (VAT_VALUE.exec(v.toUpperCase())?.[1] ?? v).trim(),
  },
  {
    key: "su_referencia",
    labels: ["SU REFERENCIA", "YOUR REFERENCE", "REFERENCIA", "REF CLIENTE"],
  },
  {
    key: "forma_pago",
    labels: ["FORMA DE PAGO", "FORMA PAGO", "PAYMENT TERMS", "CONDICIONES DE PAGO"],
  },
  {
    key: "ultimo_tenedor",
    labels: ["ULTIMO TENEDOR", "LAST HOLDER"],
  },
  {
    key: "supplier_name",
    labels: ["PROVEEDOR", "SUPPLIER", "EXPORTADOR", "EXPORTER", "VENDEDOR", "SELLER"],
  },
  {
    key: "total_contenedores",
    labels: ["TOTAL CONTENEDORES", "TOTAL CONTAINERS", "N CONTENEDORES", "NUMERO DE CONTENEDORES"],
    validate: (v) => /\d/.test(v),
    clean: (v) => (/(\d+)/.exec(v)?.[1] ?? v).trim(),
  },
  {
    key: "partida_arancelaria",
    labels: ["PARTIDA ARANCELARIA", "CODIGO C E E", "CODIGO CEE", "COD C E E", "HS CODE", "TARIC", "CODIGO ARANCELARIO"],
    validate: (v) => CEE_CODE.test(v),
    clean: (v) => CEE_CODE.exec(v)?.[1]?.replace(/\s/g, "") ?? v,
  },
  {
    key: "pais_origen",
    labels: ["PAIS DE ORIGEN", "COUNTRY OF ORIGIN", "ORIGEN"],
  },
  {
    key: "pais_destino",
    labels: ["PAIS DE DESTINO", "COUNTRY OF DESTINATION", "DESTINO"],
  },
];

/** Labels that introduce a multi-line address block. */
const ADDRESS_LABELS = [
  "COMPRADOR DESTINATARIO",
  "COMPRADOR",
  "DESTINATARIO",
  "CONSIGNEE",
  "BUYER",
  "SHIP TO",
  "DELIVERY ADDRESS",
];

/** "082 SLIM MATE" as suppliers print it, and NEXORA's own "Familia 082: …". */
const FAMILY_LEGEND = /^(\d{3})\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 .+/-]{2,40})$/;
const FAMILY_LEGEND_LABELLED = /^Familia\s+(\d{3})\s*:\s*([A-Za-zÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ .+/-]{2,40})$/i;

export function extractMeta(documents: DocumentText[]): InvoiceMeta {
  const meta: InvoiceMeta = { ...EMPTY_META };
  // Invoices carry better header data than packing lists, so read them last
  // and let them overwrite.
  const ordered = [...documents].sort((a, b) => scoreRole(a.role) - scoreRole(b.role));

  for (const doc of ordered) {
    const lines = doc.pages.flatMap((p) => p.lines);
    for (const spec of LABEL_SPECS) {
      const value = findLabelled(doc.pages, lines, spec);
      if (value) meta[spec.key] = value;
    }

    const address = findAddressBlock(lines);
    if (address.name && !meta.client_name) meta.client_name = address.name;
    if (address.lines.length) meta.client_address = address.lines.join(", ");

    const container = findContainer(lines);
    if (container.contenedor) meta.contenedor = container.contenedor;
    if (container.precinto) meta.precinto = container.precinto;

    const legend = findFamilyLegend(lines);
    if (legend) meta.familia_leyenda = legend;

    const cee = findCeeDescription(lines);
    if (cee) meta.codigo_cee = cee;
  }

  if (!meta.partida_arancelaria && meta.codigo_cee) {
    meta.partida_arancelaria = CEE_CODE.exec(meta.codigo_cee)?.[1] ?? "";
  }
  if (!meta.codigo_cee && meta.partida_arancelaria) {
    meta.codigo_cee = meta.partida_arancelaria;
  }
  meta.pais_origen = normalizeCountry(meta.pais_origen) || "ES";
  meta.pais_destino = normalizeCountry(meta.pais_destino) || guessDestination(meta.client_address);

  return meta;
}

function scoreRole(role: string): number {
  return /factura|invoice/i.test(role) ? 1 : 0;
}

/**
 * Finds a label anywhere in the document and returns its value: the text to the
 * right on the same line, or the run sitting directly below the label.
 */
function findLabelled(pages: PageText[], lines: TextLine[], spec: LabelSpec): string {
  const accept = (candidate: string): string | null => {
    const value = candidate.replace(/^[:\-–—/\s]+/, "").trim();
    if (!value) return null;
    // "CLIENTE / BUYER" leaves "BUYER" behind: a caption, never a value.
    if (isKnownLabel(value)) return null;
    if (spec.validate && !spec.validate(value)) return null;
    const cleaned = (spec.clean ? spec.clean(value) : value).trim();
    return cleaned.length ? cleaned : null;
  };

  for (const label of spec.labels) {
    for (const line of lines) {
      const normalized = normalizeLabel(line.text);
      const at = normalized.indexOf(label);
      if (at < 0) continue;
      // Must be a standalone label, not a fragment of a longer word.
      const before = at === 0 ? " " : normalized[at - 1];
      const after = normalized[at + label.length] ?? " ";
      if (/[A-Z0-9]/.test(before) || /[A-Z0-9]/.test(after)) continue;

      const sameLine = accept(valueAfterLabel(line, label));
      if (sameLine) return sameLine;

      const below = accept(valueBelowLabel(pages, lines, line, label));
      if (below) return below;
    }
  }

  for (const pattern of spec.patterns ?? []) {
    for (const line of lines) {
      const match = pattern.exec(line.text);
      const captured = match?.[1] ? accept(match[1]) : null;
      if (captured) return captured;
    }
  }
  return "";
}

/** Widest gap between two runs that still reads as the same field's value. */
const MAX_VALUE_GAP = 26;

/**
 * Takes the runs that follow the label on its line, stopping at the next label
 * or at a column-sized gap. Working on runs rather than the joined string is
 * what keeps "NUMERO FACTURA 000388/61   COMPRADOR   Pag. 1" from swallowing
 * the two neighbouring columns.
 */
function valueAfterLabel(line: TextLine, label: string): string {
  const end = findLabelEnd(line, label);
  if (!end) return "";

  const collected: string[] = end.remainder ? [end.remainder] : [];
  for (let i = end.index; i < line.items.length; i++) {
    const item = line.items[i];
    const previous = line.items[i - 1];
    const gap = previous ? item.x - (previous.x + previous.width) : 0;
    if (collected.length > 0 && gap > MAX_VALUE_GAP) break;
    if (isKnownLabel(item.text)) break;
    if (startsKnownLabel(line.items.slice(i))) break;
    collected.push(item.text.trim());
  }
  return collected.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Locates the end of the label: the index of the first run past it, plus any
 * text left over when the label shares a run with its value ("N\u00ba: INV/\u2026").
 */
function findLabelEnd(line: TextLine, label: string): { index: number; remainder: string } | null {
  for (let i = 0; i < line.items.length; i++) {
    let accumulated = "";
    for (let j = i; j < line.items.length && j < i + 4; j++) {
      const raw = line.items[j].text;
      accumulated = normalizeLabel(`${accumulated} ${raw}`);
      if (accumulated === label) return { index: j + 1, remainder: "" };
      if (accumulated.startsWith(label)) {
        return { index: j + 1, remainder: sliceAfterLabel(raw, label) };
      }
      if (!label.startsWith(accumulated)) break;
    }
  }
  return null;
}

/** Drops the label prefix from a run that carries both label and value. */
function sliceAfterLabel(raw: string, label: string): string {
  const tokens = label.split(" ");
  const lastToken = tokens[tokens.length - 1];
  const normalized = normalizeLabel(raw);
  const at = normalized.lastIndexOf(lastToken);
  if (at < 0) return "";

  // Walk the raw text until we have consumed as many alphanumerics as the
  // normalized prefix holds; whatever follows is the value.
  const consume = (normalized.slice(0, at + lastToken.length).match(/[A-Z0-9]/g) ?? []).length;
  let seen = 0;
  for (let i = 0; i < raw.length; i++) {
    if (/[A-Za-z0-9]/.test(raw[i].normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) seen += 1;
    if (seen === consume) return raw.slice(i + 1).replace(/^[:\-\u2013\u2014\s]+/, "").trim();
  }
  return "";
}

/** True when the next runs spell out another known label. */
function startsKnownLabel(items: TextLine["items"]): boolean {
  let accumulated = "";
  for (let i = 0; i < items.length && i < 3; i++) {
    accumulated = normalizeLabel(`${accumulated} ${items[i].text}`);
    if (isKnownLabel(accumulated)) return true;
  }
  return false;
}

/** Narrowest column a stacked label/value pair can occupy. */
const MIN_COLUMN_WIDTH = 120;

/** Looks for the value in the cell under the label, within the next two lines. */
function valueBelowLabel(pages: PageText[], lines: TextLine[], line: TextLine, label: string): string {
  const head = label.split(" ")[0];
  const labelItem = line.items.find((item) => normalizeLabel(item.text).includes(head));
  if (!labelItem) return "";

  const page = pages.find((p) => p.lines.includes(line));
  const scope = page ? page.lines : lines;
  const index = scope.indexOf(line);
  if (index < 0) return "";

  // The value sits in the label's column: from the label's left edge up to
  // wherever the next column starts on the label's own line.
  const nextColumn = line.items.find((item) => item.x > labelItem.x + Math.max(labelItem.width, 20) + 20);
  const right = nextColumn ? nextColumn.x - 4 : labelItem.x + MIN_COLUMN_WIDTH;

  for (let offset = 1; offset <= 2 && index + offset < scope.length; offset++) {
    const candidate = scope[index + offset];
    if (candidate.y - line.y > 40) break;
    const under = candidate.items.filter((item) => item.x >= labelItem.x - 6 && item.x < right);
    const text = under.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim();
    if (!text) continue;
    // The first thing printed under the label is the answer — if it turns out
    // to be another caption, the label simply has no value.
    return isKnownLabel(text) ? "" : text;
  }
  return "";
}

/** Form captions that are never a value, whatever label sits above them. */
const NEVER_A_VALUE = new Set([
  "REPRESENTANTE",
  "ALBARAN",
  "PAG",
  "PAGINA",
  "PAGE",
  "OBSERVACIONES",
  "TRANSPORTISTA",
  "AGENTE",
  "EXPEDICION",
  "PACKING LIST",
  "TOTAL",
  "TOTALES",
]);

function isKnownLabel(text: string): boolean {
  const normalized = normalizeLabel(text);
  if (!normalized) return false;
  if (NEVER_A_VALUE.has(normalized)) return true;
  if (LABEL_SPECS.some((spec) => spec.labels.includes(normalized))) return true;
  if (ADDRESS_LABELS.includes(normalized)) return true;
  // Column headings ("PRECINTO", "DESIGNACIÓN / MODELO") are never values.
  return matchField(text) !== null;
}

/** Reads the consignee block: the label line plus the address lines under it. */
function findAddressBlock(lines: TextLine[]): { name: string; lines: string[] } {
  for (let i = 0; i < lines.length; i++) {
    const normalized = normalizeLabel(lines[i].text);
    if (!ADDRESS_LABELS.includes(normalized)) continue;

    const collected: string[] = [];
    for (let j = i + 1; j < lines.length && collected.length < 5; j++) {
      const candidate = lines[j];
      if (candidate.y - lines[j - 1].y > 26) break;
      const text = candidate.text.trim();
      if (!text || isKnownLabel(text)) break;
      collected.push(text.replace(/,\s*$/, ""));
    }
    if (collected.length) {
      return { name: collected[0], lines: collected.slice(1) };
    }
  }
  return { name: "", lines: [] };
}

function findContainer(lines: TextLine[]): { contenedor: string; precinto: string } {
  for (const line of lines) {
    const context = readContainerContext(line.text);
    if (context && (context.contenedor || context.precinto)) return context;
  }
  return { contenedor: "", precinto: "" };
}

/** Collects "082 SLIM MATE" style family legends. */
function findFamilyLegend(lines: TextLine[]): string {
  const found: string[] = [];
  for (const line of lines) {
    const text = line.text.trim();
    const match = FAMILY_LEGEND.exec(text) ?? FAMILY_LEGEND_LABELLED.exec(text);
    if (!match) continue;
    const entry = `${match[1]} ${match[2].trim().toUpperCase()}`;
    if (!found.includes(entry)) found.push(entry);
  }
  return found.join("\n");
}

/**
 * Grabs the customs description, e.g. "69072100-COEFICIENTE ABSORCION <=0,5%".
 * The same line usually continues with that code's totals, so the value is cut
 * at the first purely numeric run.
 */
function findCeeDescription(lines: TextLine[]): string {
  for (const line of lines) {
    const text = line.text.trim();
    const looksLikeCee = /^\d{8}\s*[-–]\s*\S/.test(text) || /^\d{4}\.\d{2}\.\d{2}\s*[-–]\s*\S/.test(text);
    if (!looksLikeCee) continue;

    const parts: string[] = [];
    for (const item of line.items) {
      if (parts.length > 0 && /^[\d.,]+$/.test(item.text.trim())) break;
      parts.push(item.text.trim());
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }
  return "";
}

const COUNTRY_CODES: Record<string, string> = {
  ESPANA: "ES",
  SPAIN: "ES",
  PALESTINE: "PS",
  "WEST BANK": "PS",
  MARRUECOS: "MA",
  MOROCCO: "MA",
  FRANCIA: "FR",
  FRANCE: "FR",
  PORTUGAL: "PT",
  ITALIA: "IT",
  ITALY: "IT",
  ISRAEL: "IL",
  JORDANIA: "JO",
  JORDAN: "JO",
  ARGELIA: "DZ",
  ALGERIA: "DZ",
  TUNEZ: "TN",
  TUNISIA: "TN",
  EGIPTO: "EG",
  EGYPT: "EG",
  "ARABIA SAUDI": "SA",
  "SAUDI ARABIA": "SA",
  EMIRATOS: "AE",
  "UNITED ARAB EMIRATES": "AE",
  QATAR: "QA",
  KUWAIT: "KW",
  LIBANO: "LB",
  LEBANON: "LB",
  TURQUIA: "TR",
  TURKEY: "TR",
  "REINO UNIDO": "GB",
  "UNITED KINGDOM": "GB",
  "ESTADOS UNIDOS": "US",
  "UNITED STATES": "US",
  USA: "US",
  MEXICO: "MX",
  COLOMBIA: "CO",
  CHILE: "CL",
};

function normalizeCountry(value: string): string {
  const normalized = normalizeLabel(value);
  if (!normalized) return "";
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  return COUNTRY_CODES[normalized] ?? "";
}

function guessDestination(address: string): string {
  const normalized = normalizeLabel(address);
  for (const [name, code] of Object.entries(COUNTRY_CODES)) {
    if (normalized.includes(name)) return code;
  }
  return "";
}
