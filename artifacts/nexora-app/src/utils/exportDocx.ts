/**
 * DOCX Export — NEXORA CERAMICA S.L.
 *
 * Word version of the same packing list model the PDF renders: brand header,
 * invoice/buyer/origin panels, reference strip, container-grouped grid with a
 * totals row, shipment summary, customs block and the export note.
 *
 * Layout and wording come from `nexoraPdfTheme` and `packingGroups`, so the two
 * exports cannot drift apart.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow as DocxTableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import { fmtNum } from "@/services/extraction/numbers";
import type { InvoiceMeta, TableRow } from "@/types/packing";
import { BRAND, COLUMN_WIDTHS, COMPANY, ORIGIN_NOTE, VAT_NOTE } from "./nexoraPdfTheme";
import { computeTotals, designation, groupByContainer } from "./packingGroups";

const FONT = "Calibri";
const SIZE_SM = 13; // half-points → 6.5pt
const SIZE_MD = 15;
const SIZE_LG = 18;
const SIZE_TITLE = 26;
const SIZE_BRAND = 30;

/** Usable width of an A4 landscape page with 1cm margins, in twips. */
const PAGE_WIDTH = 14400;

const hex = (color: string) => color.replace("#", "");

const NO_BORDERS = {
  top: { style: BorderStyle.NIL },
  bottom: { style: BorderStyle.NIL },
  left: { style: BorderStyle.NIL },
  right: { style: BorderStyle.NIL },
  insideHorizontal: { style: BorderStyle.NIL },
  insideVertical: { style: BorderStyle.NIL },
} as const;

const HAIRLINE = {
  top: { style: BorderStyle.SINGLE, size: 2, color: hex(BRAND.rule) },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: hex(BRAND.rule) },
  left: { style: BorderStyle.SINGLE, size: 2, color: hex(BRAND.rule) },
  right: { style: BorderStyle.SINGLE, size: 2, color: hex(BRAND.rule) },
} as const;

const PANEL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: hex(BRAND.goldSoft) },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: hex(BRAND.goldSoft) },
  left: { style: BorderStyle.SINGLE, size: 4, color: hex(BRAND.goldSoft) },
  right: { style: BorderStyle.SINGLE, size: 4, color: hex(BRAND.goldSoft) },
} as const;

interface RunOptions {
  bold?: boolean;
  size?: number;
  color?: string;
  italics?: boolean;
  spacing?: number;
}

function run(text: string, options: RunOptions = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    bold: options.bold ?? false,
    italics: options.italics ?? false,
    size: options.size ?? SIZE_MD,
    color: hex(options.color ?? BRAND.ink),
    characterSpacing: options.spacing,
  });
}

function para(
  children: TextRun[],
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT
): Paragraph {
  return new Paragraph({ children, alignment, spacing: { before: 0, after: 0 } });
}

function spacer(after = 120): Paragraph {
  return new Paragraph({ children: [run("")], spacing: { after } });
}

const dash = (value: string) => (value.trim() ? value.trim() : "-");

/** Column widths in twips, taken from the model's proportions. */
const W = Object.fromEntries(
  Object.entries(COLUMN_WIDTHS).map(([key, share]) => [key, Math.round((share / 100) * PAGE_WIDTH)])
) as Record<keyof typeof COLUMN_WIDTHS, number>;

function headCell(text: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: hex(BRAND.ink), color: "auto" },
    verticalAlign: VerticalAlign.CENTER,
    borders: HAIRLINE,
    children: [para([run(text, { bold: true, size: SIZE_SM, color: BRAND.white, spacing: 6 })], AlignmentType.CENTER)],
  });
}

function bodyCell(
  text: string,
  width: number,
  options: { bold?: boolean; fill?: string; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; rowSpan?: number } = {}
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: options.fill ? { type: ShadingType.CLEAR, fill: hex(options.fill), color: "auto" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    borders: HAIRLINE,
    rowSpan: options.rowSpan,
    children: [
      para(
        [run(text, { bold: options.bold, size: SIZE_SM, color: options.color })],
        options.align ?? AlignmentType.CENTER
      ),
    ],
  });
}

function panelCell(title: string, lines: { text: string; bold?: boolean }[], width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: PANEL_BORDER,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      para([run(title, { bold: true, size: SIZE_SM, color: BRAND.gold, spacing: 12 })]),
      ...lines.map((line) => para([run(line.text, { bold: line.bold, size: SIZE_MD })])),
    ],
  });
}

function stripCell(label: string, value: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: PANEL_BORDER,
    shading: { type: ShadingType.CLEAR, fill: hex(BRAND.sand), color: "auto" },
    margins: { top: 50, bottom: 50, left: 120, right: 120 },
    children: [
      para([
        run(`${label}: `, { bold: true, size: SIZE_SM, color: BRAND.gold, spacing: 8 }),
        run(dash(value), { size: SIZE_SM }),
      ]),
    ],
  });
}

function summaryRow(label: string, value: string, alt: boolean): DocxTableRow {
  const shading = alt ? { type: ShadingType.CLEAR, fill: hex(BRAND.cream), color: "auto" } : undefined;
  return new DocxTableRow({
    children: [
      new TableCell({
        width: { size: 4200, type: WidthType.DXA },
        borders: NO_BORDERS,
        shading,
        children: [para([run(label, { size: SIZE_MD })])],
      }),
      new TableCell({
        width: { size: 2400, type: WidthType.DXA },
        borders: NO_BORDERS,
        shading,
        children: [para([run(value, { bold: true, size: SIZE_MD })], AlignmentType.RIGHT)],
      }),
    ],
  });
}

export async function exportPackingListDocx(rows: TableRow[], meta: InvoiceMeta): Promise<void> {
  const groups = groupByContainer(rows, meta);
  const totals = computeTotals(rows, groups);
  const declaredContainers = Number.parseInt(meta.total_contenedores, 10);
  const containerCount = totals.contenedores || (Number.isFinite(declaredContainers) ? declaredContainers : 1);

  // ── Brand header ──
  const header = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 0 },
      children: [run(COMPANY.name, { bold: true, size: SIZE_BRAND, spacing: 12 })],
    }),
    para([run(COMPANY.suffix, { bold: true, size: SIZE_SM, color: BRAND.gold, spacing: 40 })]),
    para([run(`${COMPANY.legalName} — NIF: ${COMPANY.nif}`, { size: SIZE_SM, color: BRAND.inkSoft })]),
    para([run(`${COMPANY.street}, ${COMPANY.city}`, { size: SIZE_SM, color: BRAND.inkSoft })]),
    para([run(COMPANY.email, { size: SIZE_SM, color: BRAND.inkSoft })]),
    spacer(160),
  ];

  // ── Title band ──
  const titleBand = new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    borders: NO_BORDERS,
    rows: [
      new DocxTableRow({
        children: [
          new TableCell({
            width: { size: PAGE_WIDTH, type: WidthType.DXA },
            borders: NO_BORDERS,
            shading: { type: ShadingType.CLEAR, fill: hex(BRAND.gold), color: "auto" },
            margins: { top: 90, bottom: 90 },
            children: [
              para([run("PACKING LIST", { bold: true, size: SIZE_TITLE, color: BRAND.white, spacing: 80 })], AlignmentType.CENTER),
            ],
          }),
        ],
      }),
    ],
  });

  // ── Invoice · Buyer · Origin ──
  const third = Math.round(PAGE_WIDTH / 3);
  const panels = new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    borders: NO_BORDERS,
    rows: [
      new DocxTableRow({
        children: [
          panelCell(
            "FACTURA / INVOICE",
            [
              { text: `Nº: ${dash(meta.invoice_reference)}`, bold: true },
              { text: `Fecha: ${dash(meta.invoice_date)}`, bold: true },
              ...(meta.supplier_name.trim() ? [{ text: `Proveedor: ${meta.supplier_name.trim()}` }] : []),
            ],
            third
          ),
          panelCell(
            "CLIENTE / BUYER",
            [
              { text: dash(meta.client_name), bold: true },
              ...(meta.client_address.trim() ? [{ text: meta.client_address.trim() }] : []),
              ...(meta.client_vat.trim() ? [{ text: `VAT: ${meta.client_vat.trim()}` }] : []),
            ],
            third
          ),
          panelCell(
            "ORIGEN DE LA MERCANCÍA",
            meta.origen_mercancia
              .split(/\s*—\s*|\n/)
              .map((line) => line.trim())
              .filter(Boolean)
              .map((text) => ({ text })),
            PAGE_WIDTH - third * 2
          ),
        ],
      }),
    ],
  });

  // ── Reference strip ──
  const strip = new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    borders: NO_BORDERS,
    rows: [
      new DocxTableRow({
        children: [
          stripCell("SU REFERENCIA", meta.su_referencia, third),
          stripCell("FORMA DE PAGO", meta.forma_pago, third),
          stripCell("ÚLTIMO TENEDOR", meta.ultimo_tenedor || meta.client_name, PAGE_WIDTH - third * 2),
        ],
      }),
    ],
  });

  // ── Item grid ──
  const headerRow = new DocxTableRow({
    tableHeader: true,
    children: [
      headCell("Nº", W.num),
      headCell("CONTENEDOR", W.contenedor),
      headCell("PRECINTO", W.precinto),
      headCell("FORMATO", W.formato),
      headCell("DESIGNACIÓN / MODELO", W.modelo),
      headCell("CAL.", W.cal),
      headCell("TONO", W.tono),
      headCell("NRO. PALETS", W.palets),
      headCell("CAJAS", W.cajas),
      headCell("M2", W.m2),
      headCell("PESO BRUTO (KG)", W.bruto),
    ],
  });

  let itemIndex = 0;
  const dataRows: DocxTableRow[] = [];
  for (const group of groups) {
    group.rows.forEach((row, rowIndex) => {
      itemIndex += 1;
      const zebra = itemIndex % 2 === 0 ? BRAND.tint : BRAND.white;
      const first = rowIndex === 0;
      const span = group.rows.length;

      dataRows.push(
        new DocxTableRow({
          children: [
            // A merged cell is declared on its first row and continued after.
            ...(first
              ? [
                  bodyCell(String(group.index), W.num, { bold: true, fill: BRAND.cream, color: BRAND.gold, rowSpan: span }),
                  bodyCell(dash(group.contenedor), W.contenedor, { bold: true, fill: BRAND.cream, rowSpan: span }),
                  bodyCell(dash(group.precinto), W.precinto, { bold: true, fill: BRAND.cream, rowSpan: span }),
                ]
              : []),
            bodyCell(row.formato, W.formato, { fill: zebra }),
            bodyCell(designation(row), W.modelo, { fill: zebra, align: AlignmentType.LEFT }),
            bodyCell(row.cal, W.cal, { fill: zebra }),
            bodyCell(row.tono, W.tono, { fill: zebra }),
            bodyCell(fmtNum(row.nro_palets), W.palets, { fill: zebra }),
            bodyCell(fmtNum(row.cajas), W.cajas, { fill: zebra }),
            bodyCell(fmtNum(row.m2), W.m2, { fill: zebra }),
            ...(first
              ? [bodyCell(fmtNum(group.pesoBruto), W.bruto, { bold: true, fill: BRAND.cream, rowSpan: span })]
              : []),
          ],
        })
      );
    });
  }

  const totalsRow = new DocxTableRow({
    children: [
      new TableCell({
        width: {
          size: W.num + W.contenedor + W.precinto + W.formato + W.modelo + W.cal + W.tono,
          type: WidthType.DXA,
        },
        columnSpan: 7,
        borders: HAIRLINE,
        shading: { type: ShadingType.CLEAR, fill: hex(BRAND.sand), color: "auto" },
        children: [para([run("TOTAL", { bold: true, size: SIZE_MD, spacing: 20 })], AlignmentType.CENTER)],
      }),
      bodyCell(fmtNum(totals.palets), W.palets, { bold: true, fill: BRAND.sand }),
      bodyCell(fmtNum(totals.cajas), W.cajas, { bold: true, fill: BRAND.sand }),
      bodyCell(fmtNum(totals.m2), W.m2, { bold: true, fill: BRAND.sand }),
      bodyCell(fmtNum(totals.pesoBruto), W.bruto, { bold: true, fill: BRAND.sand }),
    ],
  });

  const grid = new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    rows: [headerRow, ...dataRows, totalsRow],
  });

  // ── Shipment summary + customs ──
  const summary = new Table({
    width: { size: 6600, type: WidthType.DXA },
    borders: NO_BORDERS,
    rows: [
      summaryRow("Nº Contenedores:", String(containerCount), false),
      summaryRow("Total Palets:", fmtNum(totals.palets), true),
      summaryRow("Total Cajas:", fmtNum(totals.cajas), false),
      summaryRow("Total M2:", fmtNum(totals.m2), true),
      ...(totals.piezas > 0 ? [summaryRow("Total Piezas:", fmtNum(totals.piezas, 0), false)] : []),
      summaryRow("Peso Neto:", `${fmtNum(totals.pesoNeto)} Kg`, true),
      summaryRow("Peso Bruto:", `${fmtNum(totals.pesoBruto)} Kg`, false),
    ],
  });

  const legend = meta.familia_leyenda.split("\n").map((l) => l.trim()).filter(Boolean);
  const customs = new Table({
    width: { size: 6600, type: WidthType.DXA },
    borders: NO_BORDERS,
    rows: [
      summaryRow("Partida Arancelaria:", dash(meta.partida_arancelaria), false),
      summaryRow("País de Origen:", dash(meta.pais_origen), true),
      summaryRow("País de Destino:", dash(meta.pais_destino), false),
      ...legend.map((line, i) => {
        const [code, ...rest] = line.split(/\s+/);
        return summaryRow(`Familia ${code}:`, rest.join(" "), i % 2 === 0);
      }),
    ],
  });

  const summaryBlock = new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    borders: NO_BORDERS,
    rows: [
      new DocxTableRow({
        children: [
          new TableCell({
            width: { size: Math.round(PAGE_WIDTH * 0.52), type: WidthType.DXA },
            borders: NO_BORDERS,
            children: [
              para([run("RESUMEN DEL ENVÍO", { bold: true, size: SIZE_LG, color: BRAND.gold, spacing: 30 })]),
              spacer(60),
              summary,
            ],
          }),
          new TableCell({
            width: { size: Math.round(PAGE_WIDTH * 0.48), type: WidthType.DXA },
            borders: NO_BORDERS,
            children: [
              para([run("CÓDIGO C.E.E.", { bold: true, size: SIZE_LG, color: BRAND.gold, spacing: 30 })]),
              spacer(60),
              customs,
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: COMPANY.legalName,
    title: `Packing List ${meta.invoice_reference || ""}`.trim(),
    description: "Packing List NEXORA CERAMICA S.L.",
    sections: [
      {
        properties: {
          page: {
            size: { orientation: "landscape" },
            margin: { top: 567, bottom: 567, left: 567, right: 567 },
          },
        },
        children: [
          ...header,
          titleBand,
          spacer(120),
          panels,
          spacer(100),
          strip,
          spacer(160),
          grid,
          spacer(240),
          summaryBlock,
          spacer(200),
          para([run(ORIGIN_NOTE, { bold: true, size: SIZE_MD, spacing: 16 })]),
          spacer(80),
          para([run(VAT_NOTE, { italics: true, size: SIZE_SM })]),
          spacer(160),
          para(
            [
              run(
                `${COMPANY.legalName} — NIF: ${COMPANY.nif} — ${COMPANY.street}, ${COMPANY.city} — ${COMPANY.email}`,
                { size: SIZE_SM, color: BRAND.inkSoft }
              ),
            ],
            AlignmentType.CENTER
          ),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const reference = (meta.invoice_reference || "export").replace(/[^\w.-]+/g, "_");
  saveAs(blob, `PACKING_LIST_${reference}.docx`);
}
