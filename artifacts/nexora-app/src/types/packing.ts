import { z } from "zod";

export const TileItemSchema = z.object({
  fam: z.string(),
  formato: z.string(),
  modelo: z.string(),
  color: z.string(),
  cal: z.string(),
  tono: z.string(),
  clbr: z.string(),
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
}
