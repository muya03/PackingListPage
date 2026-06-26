/**
 * DOCX Export — NEXORA CERAMICA S.L.
 *
 * Generates a packing list document matching the official NEXORA layout:
 * company header, two-column info block, container line, tile data table,
 * totals, summary, family legend, customs code table, VAT note, footer.
 *
 * Uses the `docx` library (v9) for programmatic OOXML generation.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow as DocxTableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
} from "docx";
import { saveAs } from "file-saver";
import type { TableRow, InvoiceMeta } from "@/types/packing";

const FONT = "Arial";
const FONT_SM = 16; // 8pt in half-points
const FONT_MD = 18; // 9pt
const FONT_LG = 22; // 11pt
const FONT_XL = 28; // 14pt

const fmtNum = (n: number, d = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const NO_BORDER = {
  top: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NIL, size: 0, color: "FFFFFF" },
};

const THIN_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
};

const HEADER_SHADING = {
  type: ShadingType.CLEAR,
  fill: "CCCCCC",
  color: "000000",
};

function txt(text: string, opts: { bold?: boolean; size?: number; font?: string } = {}) {
  return new TextRun({ text, bold: opts.bold ?? false, size: opts.size ?? FONT_MD, font: opts.font ?? FONT });
}

function para(children: TextRun[], align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT, spacingBefore = 0, spacingAfter = 0) {
  return new Paragraph({
    children,
    alignment: align,
    spacing: { before: spacingBefore, after: spacingAfter },
  });
}

function emptyLine(spacing = 40) {
  return new Paragraph({ children: [txt("")], spacing: { after: spacing } });
}

function cell(
  children: Paragraph[],
  opts: {
    borders?: Record<string, { style: string; size?: number; color?: string }>;
    width?: number;
    shading?: typeof HEADER_SHADING;
    colSpan?: number;
  } = {}
) {
  return new TableCell({
    children,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    borders: (opts.borders ?? THIN_BORDER) as any,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shading,
    columnSpan: opts.colSpan,
  });
}

function headerCell(text: string, width: number) {
  return cell(
    [para([txt(text, { bold: true, size: FONT_SM })], AlignmentType.CENTER)],
    { borders: THIN_BORDER, width, shading: HEADER_SHADING }
  );
}

function dataCell(text: string, width: number, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.CENTER) {
  return cell(
    [para([txt(text, { size: FONT_SM })], align)],
    { borders: THIN_BORDER, width }
  );
}

function totalCell(text: string, width: number) {
  return cell(
    [para([txt(text, { bold: true, size: FONT_SM })], AlignmentType.CENTER)],
    { borders: THIN_BORDER, width }
  );
}

export async function exportPackingListDocx(
  rows: TableRow[],
  meta: InvoiceMeta
): Promise<void> {
  // ── Column widths (DXA / twips, A4 narrow margins total ≈ 10500 twips) ──
  const W = {
    fam: 420,
    formato: 900,
    modelo: 1000,
    color: 750,
    cal: 430,
    tono: 600,
    clbr: 380,
    nro_palets: 590,
    m2: 560,
    piezas: 530,
    cajas: 530,
    peso_neto: 760,
    peso_bruto: 820,
  };
  const totalW = Object.values(W).reduce((a, b) => a + b, 0);

  // ── Totals ──
  const totalPalets = rows.reduce((s, r) => s + r.nro_palets, 0);
  const totalM2 = rows.reduce((s, r) => s + r.m2, 0);
  const totalPiezas = rows.reduce((s, r) => s + r.piezas, 0);
  const totalCajas = rows.reduce((s, r) => s + r.cajas, 0);
  const totalPesoNeto = rows.reduce((s, r) => s + r.peso_neto, 0);
  const totalPesoBruto = rows.reduce((s, r) => s + r.peso_bruto, 0);

  // ── 1. Company header ──
  const companyHeader = [
    para([txt("Nexora Ceramica", { bold: true, size: FONT_LG })]),
    para([txt("S.L  B24881047", { size: FONT_MD })]),
    para([txt("AVENIDA DEL MEDITERRÁNEO, 87, NAVE 3, ONDA", { size: FONT_MD })]),
    emptyLine(60),
  ];

  // ── 2. Two-column layout: PACKING LIST (left) | COMPRADOR (right) ──
  const leftChildren = [
    para([txt("PACKING LIST", { bold: true, size: FONT_XL })], AlignmentType.LEFT, 0, 80),
    para([txt("NUMERO FACTURA", { bold: true, size: FONT_MD }), txt("   " + (meta.invoice_reference || ""), { size: FONT_MD })]),
    para([txt("FECHA FACTURA", { bold: true, size: FONT_MD }), txt("     " + (meta.invoice_date || ""), { size: FONT_MD })]),
    para([txt("CLIENTE", { bold: true, size: FONT_MD }), txt("            " + (meta.client_name || ""), { size: FONT_MD })]),
    para([txt("V.A.T", { bold: true, size: FONT_MD }), txt("               " + (meta.client_vat || ""), { size: FONT_MD })]),
  ];

  const rightChildren = [
    para([txt("COMPRADOR - DESTINATARIO", { bold: true, size: FONT_MD })], AlignmentType.LEFT, 0, 40),
    ...(meta.client_name || meta.client_address
      ? (meta.client_name + (meta.client_address ? ", " + meta.client_address : ""))
          .split(/,\s*/)
          .map((line) => para([txt(line.trim(), { size: FONT_MD })]))
      : [para([txt("", { size: FONT_MD })])]),
  ];

  const infoTable = new Table({
    width: { size: totalW, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NIL },
      bottom: { style: BorderStyle.NIL },
      left: { style: BorderStyle.NIL },
      right: { style: BorderStyle.NIL },
      insideHorizontal: { style: BorderStyle.NIL },
      insideVertical: { style: BorderStyle.NIL },
    },
    rows: [
      new DocxTableRow({
        children: [
          cell(leftChildren, { borders: NO_BORDER, width: Math.round(totalW * 0.58) }),
          cell(rightChildren, { borders: NO_BORDER, width: Math.round(totalW * 0.42) }),
        ],
      }),
    ],
  });

  // ── 3. Container info line ──
  const containerParagraphs: Paragraph[] = [];
  if (meta.contenedor || meta.precinto) {
    containerParagraphs.push(
      emptyLine(40),
      para(
        [
          txt("CONTENEDOR", { bold: true, size: FONT_MD }),
          txt("   " + (meta.contenedor || "") + "          ", { size: FONT_MD }),
          txt("PRECINTO", { bold: true, size: FONT_MD }),
          txt("   " + (meta.precinto || "") + "          ", { size: FONT_MD }),
          txt("PESO NETO ", { bold: true, size: FONT_MD }),
          txt(fmtNum(totalPesoNeto) + "   ", { size: FONT_MD }),
          txt("PESO BRUTO ", { bold: true, size: FONT_MD }),
          txt(fmtNum(totalPesoBruto), { size: FONT_MD }),
        ],
        AlignmentType.LEFT
      ),
      emptyLine(40)
    );
  } else {
    containerParagraphs.push(emptyLine(60));
  }

  // ── 4. Main data table ──
  const tableHeaderRow = new DocxTableRow({
    tableHeader: true,
    children: [
      headerCell("FAM", W.fam),
      headerCell("FORMATO", W.formato),
      headerCell("MODELO", W.modelo),
      headerCell("COLOR", W.color),
      headerCell("CAL", W.cal),
      headerCell("TONO", W.tono),
      headerCell("CLBR", W.clbr),
      headerCell("NRO.PALETS", W.nro_palets),
      headerCell("M2", W.m2),
      headerCell("PIEZAS", W.piezas),
      headerCell("CAJAS", W.cajas),
      headerCell("PESO NETO", W.peso_neto),
      headerCell("PESO BRUTO", W.peso_bruto),
    ],
  });

  const dataRows = rows.map(
    (r) =>
      new DocxTableRow({
        children: [
          dataCell(r.fam, W.fam),
          dataCell(r.formato, W.formato, AlignmentType.LEFT),
          dataCell(r.modelo, W.modelo, AlignmentType.LEFT),
          dataCell(r.color, W.color, AlignmentType.LEFT),
          dataCell(r.cal, W.cal),
          dataCell(r.tono, W.tono),
          dataCell(r.clbr, W.clbr),
          dataCell(String(r.nro_palets), W.nro_palets),
          dataCell(fmtNum(r.m2), W.m2),
          dataCell(String(r.piezas), W.piezas),
          dataCell(String(r.cajas), W.cajas),
          dataCell(fmtNum(r.peso_neto), W.peso_neto),
          dataCell(fmtNum(r.peso_bruto), W.peso_bruto),
        ],
      })
  );

  const totalsRow = new DocxTableRow({
    children: [
      totalCell("", W.fam),
      totalCell("", W.formato),
      totalCell("", W.modelo),
      totalCell("", W.color),
      totalCell("", W.cal),
      totalCell("", W.tono),
      totalCell("", W.clbr),
      totalCell(String(totalPalets), W.nro_palets),
      totalCell(fmtNum(totalM2), W.m2),
      totalCell(String(totalPiezas), W.piezas),
      totalCell(String(totalCajas), W.cajas),
      totalCell(fmtNum(totalPesoNeto), W.peso_neto),
      totalCell(fmtNum(totalPesoBruto), W.peso_bruto),
    ],
  });

  const mainTable = new Table({
    width: { size: totalW, type: WidthType.DXA },
    rows: [tableHeaderRow, ...dataRows, totalsRow],
  });

  // ── 5. Summary section ──
  const summaryLines = [
    emptyLine(60),
    para([txt("PESO BRUTO (Kg)  ", { bold: true, size: FONT_MD }), txt(fmtNum(totalPesoBruto), { size: FONT_MD })]),
    para([txt("PESO NETO (Kg)   ", { bold: true, size: FONT_MD }), txt(fmtNum(totalPesoNeto), { size: FONT_MD })]),
    para([txt("TOTAL PALETS     ", { bold: true, size: FONT_MD }), txt(String(totalPalets), { size: FONT_MD })]),
    para([
      txt("TOTAL CONTENEDORES  ", { bold: true, size: FONT_MD }),
      txt(meta.total_contenedores || "1", { size: FONT_MD }),
    ]),
  ];

  // ── 6. Family legend ──
  const legendLines: Paragraph[] = [];
  if (meta.familia_leyenda) {
    legendLines.push(emptyLine(40));
    meta.familia_leyenda.split("\n").filter(Boolean).forEach((line) => {
      legendLines.push(para([txt(line.trim(), { size: FONT_MD })]));
    });
  }

  // ── 7. Customs codes table ──
  const ceeLines: Paragraph[] = [];
  if (meta.codigo_cee) {
    const ceeW = { code: 5200, m2: 900, pb: 1100, pn: 1100, pal: 900 };
    const ceeTableW = Object.values(ceeW).reduce((a, b) => a + b, 0);

    const ceeTable = new Table({
      width: { size: ceeTableW, type: WidthType.DXA },
      rows: [
        new DocxTableRow({
          children: [
            headerCell("CODIGO C.E.E.", ceeW.code),
            headerCell("M2", ceeW.m2),
            headerCell("PESO BRUTO", ceeW.pb),
            headerCell("PESO NETO", ceeW.pn),
            headerCell("PALETS", ceeW.pal),
          ],
        }),
        new DocxTableRow({
          children: [
            dataCell(meta.codigo_cee, ceeW.code, AlignmentType.LEFT),
            dataCell(fmtNum(totalM2), ceeW.m2),
            dataCell(fmtNum(totalPesoBruto), ceeW.pb),
            dataCell(fmtNum(totalPesoNeto), ceeW.pn),
            dataCell(String(totalPalets), ceeW.pal),
          ],
        }),
      ],
    });

    ceeLines.push(emptyLine(60), ceeTable as unknown as Paragraph);
  }

  // ── 8. VAT note ──
  const vatNote = [
    emptyLine(60),
    para(
      [
        txt(
          "Operacion exenta de IVA de conformidad al articulo 21 de la Ley 37/1992 del Impuesto sobre el valor Añadido",
          { size: FONT_SM }
        ),
      ],
      AlignmentType.LEFT
    ),
  ];

  // ── 9. Footer ──
  const footer = [
    emptyLine(80),
    para([txt("info@nexoraceramica.es", { size: FONT_SM })], AlignmentType.CENTER),
    para([txt("Page   1/1", { size: FONT_SM })], AlignmentType.CENTER),
  ];

  // ── Assemble document ──
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children: [
          ...companyHeader,
          infoTable,
          ...containerParagraphs,
          mainTable,
          ...summaryLines,
          ...legendLines,
          ...(ceeLines as Paragraph[]),
          ...vatNote,
          ...footer,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `PackingList_NEXORA_${meta.invoice_reference || "export"}.docx`);
}
