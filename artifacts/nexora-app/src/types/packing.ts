import { z } from "zod";

export const TileItemSchema = z.object({
  fam: z.string(),
  formato: z.string(),
  modelo: z.string(),
  color: z.string(),
  cal: z.string(),
  tono: z.string(),
  clbr: z.string(),
  contenedor: z.string().optional().default(""),
  precinto: z.string().optional().default(""),
  nro_palets: z.number(),
  m2: z.number(),
  piezas: z.number(),
  cajas: z.number(),
  peso_neto: z.number(),
  peso_bruto: z.number(),
  source_file: z.string().optional().default(""),
});

export const InvoiceResponseSchema = z.object({
  invoice_reference: z.string(),
  invoice_date: z.string(),
  supplier_name: z.string(),
  client_name: z.string().optional().default(""),
  client_vat: z.string().optional().default(""),
  client_address: z.string().optional().default(""),
  contenedor: z.string().optional().default(""),
  precinto: z.string().optional().default(""),
  familia_leyenda: z.string().optional().default(""),
  codigo_cee: z.string().optional().default(""),
  total_contenedores: z.string().optional().default("1"),
  su_referencia: z.string().optional().default(""),
  forma_pago: z.string().optional().default(""),
  ultimo_tenedor: z.string().optional().default(""),
  origen_mercancia: z.string().optional().default(""),
  partida_arancelaria: z.string().optional().default(""),
  pais_origen: z.string().optional().default(""),
  pais_destino: z.string().optional().default(""),
  items: z.array(TileItemSchema),
});

export type TileItem = z.infer<typeof TileItemSchema>;
export type InvoiceResponse = z.infer<typeof InvoiceResponseSchema>;

export interface TableRow {
  id: string;
  fam: string;
  formato: string;
  modelo: string;
  color: string;
  cal: string;
  tono: string;
  clbr: string;
  /** Container this line travels in — drives the row grouping of the PDF model. */
  contenedor: string;
  /** Seal number of the container. */
  precinto: string;
  nro_palets: number;
  m2: number;
  piezas: number;
  cajas: number;
  peso_neto: number;
  peso_bruto: number;
  source_file: string;
  custom_fields: Record<string, string>;
}

export interface InvoiceMeta {
  invoice_reference: string;
  invoice_date: string;
  supplier_name: string;
  client_name: string;
  client_vat: string;
  client_address: string;
  contenedor: string;
  precinto: string;
  familia_leyenda: string;
  codigo_cee: string;
  total_contenedores: string;
  su_referencia: string;
  forma_pago: string;
  ultimo_tenedor: string;
  origen_mercancia: string;
  partida_arancelaria: string;
  pais_origen: string;
  pais_destino: string;
}

export const EMPTY_META: InvoiceMeta = {
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
  su_referencia: "",
  forma_pago: "",
  ultimo_tenedor: "",
  origen_mercancia: "España — Bienes de origen español",
  partida_arancelaria: "",
  pais_origen: "ES",
  pais_destino: "",
};

let rowSeq = 0;

export function makeRowId(): string {
  rowSeq += 1;
  return `row-${Date.now().toString(36)}-${rowSeq}`;
}

/** Fills in every field of a partially-shaped row (restored sessions, AI output, manual adds). */
export function normalizeRow(partial: Partial<TableRow>): TableRow {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    id: partial.id || makeRowId(),
    fam: str(partial.fam),
    formato: str(partial.formato),
    modelo: str(partial.modelo),
    color: str(partial.color),
    cal: str(partial.cal),
    tono: str(partial.tono),
    clbr: str(partial.clbr),
    contenedor: str(partial.contenedor),
    precinto: str(partial.precinto),
    nro_palets: num(partial.nro_palets),
    m2: num(partial.m2),
    piezas: num(partial.piezas),
    cajas: num(partial.cajas),
    peso_neto: num(partial.peso_neto),
    peso_bruto: num(partial.peso_bruto),
    source_file: str(partial.source_file),
    custom_fields: partial.custom_fields ?? {},
  };
}

/** Fills in every field of a partially-shaped meta object. */
export function normalizeMeta(partial: Partial<InvoiceMeta> | null | undefined): InvoiceMeta {
  const base = { ...EMPTY_META };
  if (!partial) return base;
  (Object.keys(base) as (keyof InvoiceMeta)[]).forEach((k) => {
    const v = partial[k];
    if (typeof v === "string" && v.trim()) base[k] = v;
  });
  return base;
}
