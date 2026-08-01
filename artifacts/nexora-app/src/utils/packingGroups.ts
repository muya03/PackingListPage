/**
 * Container grouping.
 *
 * The NEXORA model is organised by container: one numbered block per container,
 * with its seal and gross weight spanning all the lines it carries. This turns
 * the flat editable table into exactly that shape.
 */

import type { InvoiceMeta, TableRow } from "@/types/packing";

export interface ContainerGroup {
  index: number;
  contenedor: string;
  precinto: string;
  rows: TableRow[];
  pesoBruto: number;
  pesoNeto: number;
}

export interface PackingTotals {
  palets: number;
  cajas: number;
  m2: number;
  piezas: number;
  pesoNeto: number;
  pesoBruto: number;
  contenedores: number;
}

/**
 * Groups consecutive rows that share a container. Consecutive rather than
 * global, because the same container can legitimately appear twice in a list
 * and the operator's row order is the shipping order.
 */
export function groupByContainer(rows: TableRow[], meta: InvoiceMeta): ContainerGroup[] {
  const groups: ContainerGroup[] = [];

  for (const row of rows) {
    const contenedor = row.contenedor.trim();
    const previous = groups[groups.length - 1];
    const sameAsPrevious =
      previous !== undefined && previous.contenedor === contenedor && (!contenedor ? groups.length === 1 : true);

    if (previous && sameAsPrevious) {
      previous.rows.push(row);
      previous.pesoBruto += row.peso_bruto;
      previous.pesoNeto += row.peso_neto;
      if (!previous.precinto && row.precinto.trim()) previous.precinto = row.precinto.trim();
      continue;
    }

    groups.push({
      index: groups.length + 1,
      contenedor,
      precinto: row.precinto.trim(),
      rows: [row],
      pesoBruto: row.peso_bruto,
      pesoNeto: row.peso_neto,
    });
  }

  // Without any per-row container data the whole shipment is one block, and the
  // expedition-level container/seal from the header describes it.
  if (groups.length === 1 && !groups[0].contenedor) {
    groups[0].contenedor = meta.contenedor.trim();
    groups[0].precinto = groups[0].precinto || meta.precinto.trim();
  }

  return groups;
}

export function computeTotals(rows: TableRow[], groups: ContainerGroup[]): PackingTotals {
  return {
    palets: rows.reduce((s, r) => s + r.nro_palets, 0),
    cajas: rows.reduce((s, r) => s + r.cajas, 0),
    m2: rows.reduce((s, r) => s + r.m2, 0),
    piezas: rows.reduce((s, r) => s + r.piezas, 0),
    pesoNeto: rows.reduce((s, r) => s + r.peso_neto, 0),
    pesoBruto: rows.reduce((s, r) => s + r.peso_bruto, 0),
    contenedores: groups.filter((g) => g.contenedor).length || (groups.length ? 1 : 0),
  };
}

/** "MODELO COLOR" as the model prints it, without duplicating the colour. */
export function designation(row: TableRow): string {
  const modelo = row.modelo.trim();
  const color = row.color.trim();
  if (!color) return modelo;
  if (!modelo) return color;
  if (modelo.toUpperCase().includes(color.toUpperCase())) return modelo;
  return `${modelo} ${color}`;
}
