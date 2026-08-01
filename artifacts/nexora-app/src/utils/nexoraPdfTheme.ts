/**
 * The NEXORA document design tokens.
 *
 * Colours, proportions and type sizes are taken from the approved packing list
 * model so both orientations render the same document, only reflowed.
 */

export const BRAND = {
  /** Signature warm gold. */
  gold: "#B8935A",
  /** Softer gold used for rules and panel borders. */
  goldSoft: "#D9C9AC",
  /** Ink. */
  ink: "#1A1A1A",
  /** Secondary text. */
  inkSoft: "#444444",
  /** Hairlines between rows. */
  rule: "#E5E0D5",
  /** Zebra tint for item rows. */
  tint: "#FBFAF7",
  /** Fill for grouped (container) cells. */
  cream: "#FAF7F0",
  /** Fill for the reference strip and the totals row. */
  sand: "#F4EDE0",
  white: "#FFFFFF",
} as const;

export const COMPANY = {
  name: "NEXORA CERAMICA",
  legalName: "Nexora Ceramica S.L",
  suffix: "S.L.",
  nif: "B24881047",
  street: "Avenida del Mediterráneo 87, nave 3",
  city: "12200 Onda, Castellón, España",
  email: "info@nexoraceramica.es",
} as const;

export const VAT_NOTE =
  "Operación exenta de IVA conforme al artículo 21 de la Ley 37/1992 del IVA (exportación de bienes fuera de la Unión Europea).";

export const ORIGIN_NOTE = "BIENES DE ORIGEN ESPAÑOL";

/** Column widths as a share of the table, straight from the model. */
export const COLUMN_WIDTHS = {
  num: 2.59,
  contenedor: 10.66,
  precinto: 11.98,
  formato: 7.92,
  modelo: 18.71,
  cal: 4.06,
  tono: 4.84,
  palets: 10.3,
  cajas: 7.64,
  m2: 7.64,
  bruto: 13.67,
} as const;

/** Share of the table taken by the per-line columns, as one block. */
export const ITEM_BLOCK_WIDTH =
  COLUMN_WIDTHS.formato +
  COLUMN_WIDTHS.modelo +
  COLUMN_WIDTHS.cal +
  COLUMN_WIDTHS.tono +
  COLUMN_WIDTHS.palets +
  COLUMN_WIDTHS.cajas +
  COLUMN_WIDTHS.m2;

/** The same per-line columns re-expressed against the block that holds them. */
export const ITEM_WIDTHS = {
  formato: (COLUMN_WIDTHS.formato / ITEM_BLOCK_WIDTH) * 100,
  modelo: (COLUMN_WIDTHS.modelo / ITEM_BLOCK_WIDTH) * 100,
  cal: (COLUMN_WIDTHS.cal / ITEM_BLOCK_WIDTH) * 100,
  tono: (COLUMN_WIDTHS.tono / ITEM_BLOCK_WIDTH) * 100,
  palets: (COLUMN_WIDTHS.palets / ITEM_BLOCK_WIDTH) * 100,
  cajas: (COLUMN_WIDTHS.cajas / ITEM_BLOCK_WIDTH) * 100,
  m2: (COLUMN_WIDTHS.m2 / ITEM_BLOCK_WIDTH) * 100,
} as const;

export const pct = (value: number): `${number}%` => `${value}%`;

export type PdfOrientation = "portrait" | "landscape";
