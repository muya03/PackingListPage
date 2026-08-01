/**
 * The column dictionary.
 *
 * Supplier packing lists all carry the same information under different
 * headings and in three or four languages. Mapping those headings to NEXORA's
 * canonical columns is what removes the need for a model to "understand" the
 * document: once a heading is recognised, everything under it is data.
 */

import { normalizeLabel } from "./lines";

export type FieldKey =
  | "orden"
  | "fam"
  | "formato"
  | "modelo"
  | "color"
  | "cal"
  | "tono"
  | "clbr"
  | "contenedor"
  | "precinto"
  | "nro_palets"
  | "m2"
  | "piezas"
  | "cajas"
  | "peso_neto"
  | "peso_bruto";

export type FieldType = "text" | "number";

interface FieldSpec {
  key: FieldKey;
  type: FieldType;
  label: string;
  /** Header spellings, already normalized (upper-case, unaccented, single spaces). */
  synonyms: string[];
}

const SPECS: FieldSpec[] = [
  {
    // Not a packing-list value: the ordinal marks where each block of lines
    // starts, which is how merged container cells are put back together.
    key: "orden",
    type: "text",
    label: "Nº",
    synonyms: ["N", "NO", "NUM", "NRO", "LINEA", "ITEM", "POS", "ORDEN"],
  },
  {
    key: "fam",
    type: "text",
    label: "FAM",
    synonyms: ["FAM", "FAMILIA", "FAMILY", "FLIA", "GRUPO"],
  },
  {
    key: "formato",
    type: "text",
    label: "FORMATO",
    synonyms: ["FORMATO", "FORMAT", "MEDIDA", "MEDIDAS", "SIZE", "DIMENSION", "DIMENSIONES", "DIMENSIONI", "FORMATO CM"],
  },
  {
    key: "modelo",
    type: "text",
    label: "MODELO",
    synonyms: [
      "MODELO",
      "MODEL",
      "DESIGNACION",
      "DESIGNACION MODELO",
      "DESIGNATION",
      "SERIE",
      "SERIES",
      "DESCRIPCION",
      "DESCRIPCION ARTICULO",
      "DESCRIPTION",
      "DESCRIZIONE",
      "ARTICULO",
      "ARTICLE",
      "ARTICLE NO",
      "ARTICULO NO",
      "PRODUCTO",
      "PRODUCT",
      "REFERENCIA",
      "COD ARTICULO",
    ],
  },
  {
    key: "color",
    type: "text",
    label: "COLOR",
    synonyms: ["COLOR", "COLOUR", "COLORE", "ACABADO", "FINISH"],
  },
  {
    key: "cal",
    type: "text",
    label: "CAL",
    synonyms: ["CAL", "CALIDAD", "QUALITY", "QUALITA", "CHOICE", "QLT", "GRADE"],
  },
  {
    key: "tono",
    type: "text",
    label: "TONO",
    synonyms: ["TONO", "TONE", "TON", "LOTE", "LOT", "BATCH", "TONALITA", "SHADE"],
  },
  {
    key: "clbr",
    type: "text",
    label: "CLBR",
    synonyms: ["CLBR", "CALIBRE", "CALIBER", "CALIBRO", "CLB", "GAUGE"],
  },
  {
    key: "contenedor",
    type: "text",
    label: "CONTENEDOR",
    synonyms: ["CONTENEDOR", "CONTAINER", "CONT", "CNTR", "N CONTENEDOR", "NO CONTAINER", "CONTAINER NO"],
  },
  {
    key: "precinto",
    type: "text",
    label: "PRECINTO",
    synonyms: ["PRECINTO", "SEAL", "SEAL NO", "SELLO", "N PRECINTO", "SIGILLO"],
  },
  {
    key: "nro_palets",
    type: "number",
    label: "NRO. PALETS",
    synonyms: [
      "NRO PALETS",
      "N PALETS",
      "NO PALETS",
      "NUM PALETS",
      "NUMERO PALETS",
      "PALETS",
      "PALET",
      "PALLETS",
      "PALLET",
      "NO PALLETS",
      "N PALLET",
      "BULTOS",
      "N BULTOS",
      "PACKAGES",
      "COLLI",
      "CABALLETES",
      "A FRAMES",
      "A FRAME",
    ],
  },
  {
    key: "m2",
    type: "number",
    label: "M2",
    synonyms: ["M2", "MQ", "M 2", "MTS2", "METROS", "METROS CUADRADOS", "SQM", "SQ M", "SQUARE METERS", "MTL"],
  },
  {
    key: "piezas",
    type: "number",
    label: "PIEZAS",
    synonyms: [
      "PIEZAS",
      "PIEZA",
      "PZAS",
      "PZ",
      "PCS",
      "PC",
      "PIECES",
      "PEZZI",
      "UNIDADES",
      "UNITS",
      "CANTIDAD",
      "QUANTITY",
      "QUANTITY PC",
      "QTY",
      "QTY PC",
    ],
  },
  {
    key: "cajas",
    type: "number",
    label: "CAJAS",
    synonyms: ["CAJAS", "CAJA", "CAJ", "BOXES", "BOX", "CARTONS", "CARTON", "SCATOLE"],
  },
  {
    key: "peso_neto",
    type: "number",
    label: "PESO NETO",
    synonyms: [
      "PESO NETO",
      "PESO NETO KG",
      "PESO NETO KGS",
      "NETO",
      "NET",
      "NET WEIGHT",
      "NET WEIGHT KG",
      "NETT WEIGHT",
      "PESO NETTO",
      "N W",
      "NW",
    ],
  },
  {
    key: "peso_bruto",
    type: "number",
    label: "PESO BRUTO",
    synonyms: [
      "PESO BRUTO",
      "PESO BRUTO KG",
      "PESO BRUTO KGS",
      "BRUTO",
      "GROSS",
      "GROSS WEIGHT",
      "GROSS WEIGHT KG",
      "PESO LORDO",
      "G W",
      "GW",
    ],
  },
];

export const FIELD_SPECS: ReadonlyArray<FieldSpec> = SPECS;

export const FIELD_TYPES: Record<FieldKey, FieldType> = SPECS.reduce(
  (acc, spec) => ({ ...acc, [spec.key]: spec.type }),
  {} as Record<FieldKey, FieldType>
);

export const FIELD_LABELS: Record<FieldKey, string> = SPECS.reduce(
  (acc, spec) => ({ ...acc, [spec.key]: spec.label }),
  {} as Record<FieldKey, string>
);

const EXACT_INDEX = new Map<string, FieldKey>();
for (const spec of SPECS) {
  for (const synonym of spec.synonyms) {
    // First definition wins, so earlier specs take priority on shared spellings.
    if (!EXACT_INDEX.has(synonym)) EXACT_INDEX.set(synonym, spec.key);
  }
}

/** Header noise that must be stripped before matching: units, ordinals, symbols. */
const NOISE = /\b(KG|KGS|KILOS|KILOGRAMOS|M3|CBM|EUR|EUROS|TOTAL|TOTALES|UNIT|UNIDAD|DE|DEL|LA|EL)\b/g;

function candidates(label: string): string[] {
  const base = normalizeLabel(label);
  if (!base) return [];
  const out = new Set<string>([base]);
  out.add(base.replace(NOISE, " ").replace(/\s+/g, " ").trim());
  // "DESIGNACION / MODELO" also matches on either half.
  label.split(/[/|·–—]/).forEach((part) => {
    const norm = normalizeLabel(part).replace(NOISE, " ").replace(/\s+/g, " ").trim();
    if (norm) out.add(norm);
  });
  return [...out].filter(Boolean);
}

/**
 * Resolves a raw column heading to a canonical field, or null when the heading
 * is not one we know. Matching is exact-on-synonym first, then prefix-based, so
 * "PESO BRUTO (KG)" and "Gross Weight (kg)" both land on `peso_bruto`.
 */
export function matchField(label: string): FieldKey | null {
  for (const candidate of candidates(label)) {
    const exact = EXACT_INDEX.get(candidate);
    if (exact) return exact;
  }
  for (const candidate of candidates(label)) {
    if (candidate.length < 2) continue;
    for (const spec of SPECS) {
      for (const synonym of spec.synonyms) {
        if (synonym.length < 3) continue;
        if (candidate === synonym || candidate.startsWith(`${synonym} `) || candidate.endsWith(` ${synonym}`)) {
          return spec.key;
        }
      }
    }
  }
  return null;
}
