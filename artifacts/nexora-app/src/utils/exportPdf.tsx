/**
 * PDF export — the official NEXORA packing list.
 *
 * Renders the approved model: brand header, invoice/buyer/origin panels, the
 * reference strip, the container-grouped item grid with repeating head, the
 * shipment summary and customs panel, and the export legal note.
 *
 * The same component serves both orientations — every width is a share of the
 * page, so "vertical" and "horizontal" are the same document reflowed.
 */

import React from "react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import type { InvoiceMeta, TableRow } from "@/types/packing";
import { fmtNum } from "@/services/extraction/numbers";
import {
  BRAND,
  COLUMN_WIDTHS,
  COMPANY,
  ITEM_WIDTHS,
  ITEM_BLOCK_WIDTH,
  ORIGIN_NOTE,
  VAT_NOTE,
  pct,
  type PdfOrientation,
} from "./nexoraPdfTheme";
import { computeTotals, designation, groupByContainer } from "./packingGroups";

const SANS = "Helvetica";
const SANS_BOLD = "Helvetica-Bold";
const SANS_ITALIC = "Helvetica-Oblique";

const styles = StyleSheet.create({
  page: {
    fontFamily: SANS,
    fontSize: 5.6,
    color: BRAND.ink,
    backgroundColor: BRAND.white,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 30,
  },

  /* ── Brand header ── */
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  logoMark: {
    width: 24,
    height: 24,
    borderWidth: 1.2,
    borderColor: BRAND.gold,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
  },
  logoLetter: { fontFamily: "Times-Bold", fontSize: 13, color: BRAND.gold, lineHeight: 1 },
  brandName: { fontFamily: SANS_BOLD, fontSize: 11.5, letterSpacing: 0.4, lineHeight: 1.05 },
  brandSuffix: { fontFamily: SANS_BOLD, fontSize: 5.4, letterSpacing: 2.2, color: BRAND.gold, marginTop: 1.5 },
  headerRight: { marginLeft: "auto", alignItems: "flex-end" },
  headerRightLine: { fontSize: 5.2, color: BRAND.inkSoft, lineHeight: 1.45 },

  /* ── Title band ── */
  titleBand: {
    backgroundColor: BRAND.gold,
    paddingVertical: 4.2,
    alignItems: "center",
    marginBottom: 5.5,
  },
  titleText: { fontFamily: SANS_BOLD, fontSize: 8.6, letterSpacing: 3.4, color: BRAND.white },

  /* ── Info panels ── */
  panelRow: { flexDirection: "row", marginBottom: 4.5 },
  panel: {
    borderWidth: 0.6,
    borderColor: BRAND.goldSoft,
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    minHeight: 44,
  },
  panelTitle: {
    fontFamily: SANS_BOLD,
    fontSize: 5.4,
    letterSpacing: 1,
    color: BRAND.gold,
    marginBottom: 3.5,
  },
  panelLine: { fontSize: 5.8, lineHeight: 1.5 },
  panelStrong: { fontFamily: SANS_BOLD, fontSize: 5.8, lineHeight: 1.5 },

  /* ── Reference strip ── */
  stripRow: { flexDirection: "row", borderWidth: 0.6, borderColor: BRAND.goldSoft, marginBottom: 6 },
  stripCell: { backgroundColor: BRAND.sand, paddingVertical: 3.2, paddingHorizontal: 6, flexDirection: "row" },
  stripDivider: { width: 0.6, backgroundColor: BRAND.goldSoft },
  stripLabel: { fontFamily: SANS_BOLD, fontSize: 5.4, letterSpacing: 0.7, color: BRAND.gold },
  stripValue: { fontSize: 5.4, marginLeft: 3 },

  /* ── Table ── */
  headRow: { flexDirection: "row", backgroundColor: BRAND.ink },
  headCell: {
    fontFamily: SANS_BOLD,
    fontSize: 5.2,
    letterSpacing: 0.35,
    color: BRAND.white,
    textAlign: "center",
    paddingVertical: 3.4,
    paddingHorizontal: 1.5,
  },
  group: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: BRAND.rule },
  groupCell: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 1.5,
    paddingVertical: 2,
    backgroundColor: BRAND.cream,
  },
  groupIndex: { fontFamily: SANS_BOLD, fontSize: 5.4, color: BRAND.gold },
  groupText: { fontFamily: SANS_BOLD, fontSize: 5.4, textAlign: "center" },
  itemBlock: { flexDirection: "column" },
  itemRow: { flexDirection: "row", alignItems: "center", minHeight: 10.4 },
  itemDivider: { borderTopWidth: 0.6, borderTopColor: BRAND.rule },
  cell: { fontSize: 5.4, paddingVertical: 2.4, paddingHorizontal: 2 },

  totalRow: { flexDirection: "row", backgroundColor: BRAND.sand, borderTopWidth: 1, borderTopColor: BRAND.gold },
  totalLabel: {
    fontFamily: SANS_BOLD,
    fontSize: 5.6,
    letterSpacing: 0.9,
    textAlign: "center",
    paddingVertical: 3.4,
  },
  totalValue: { fontFamily: SANS_BOLD, fontSize: 5.6, textAlign: "center", paddingVertical: 3.4, paddingHorizontal: 2 },

  /* ── Summary panels ── */
  summaryRow: {
    flexDirection: "row",
    marginTop: 10,
    borderTopWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: BRAND.goldSoft,
    paddingVertical: 6,
  },
  summaryDivider: { width: 0.6, backgroundColor: BRAND.goldSoft, marginHorizontal: 10 },
  summaryTitle: {
    fontFamily: SANS_BOLD,
    fontSize: 5.8,
    letterSpacing: 1.2,
    color: BRAND.gold,
    marginBottom: 4,
  },
  summaryLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.2, paddingHorizontal: 3 },
  summaryLineAlt: { backgroundColor: BRAND.cream },
  summaryLabel: { fontSize: 5.6 },
  summaryValue: { fontFamily: SANS_BOLD, fontSize: 5.6 },
  ceeLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2.6,
    paddingHorizontal: 14,
    borderBottomWidth: 0.6,
    borderBottomColor: BRAND.rule,
  },
  ceeLabel: { fontSize: 5.6, color: BRAND.inkSoft },
  ceeValue: { fontSize: 5.6 },

  /* ── Closing ── */
  originBox: {
    flexDirection: "row",
    marginTop: 10,
    borderTopWidth: 0.6,
    borderBottomWidth: 0.6,
    borderColor: BRAND.goldSoft,
  },
  originText: {
    fontFamily: SANS_BOLD,
    fontSize: 5.8,
    letterSpacing: 0.7,
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  vatNote: { fontFamily: SANS_ITALIC, fontSize: 5.4, color: BRAND.ink, marginTop: 6 },

  footer: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
    borderTopWidth: 0.6,
    borderTopColor: BRAND.rule,
    paddingTop: 4,
    alignItems: "center",
  },
  footerText: { fontSize: 5, color: BRAND.inkSoft },
  pageNumber: { fontSize: 5, color: BRAND.inkSoft, marginTop: 1.5 },
});

const dash = (value: string): string => (value.trim() ? value.trim() : "-");

function Panel({ title, width, children }: { title: string; width: number; children: React.ReactNode }) {
  return (
    <View style={[styles.panel, { width: pct(width) }]}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StripCell({ label, value, width }: { label: string; value: string; width: number }) {
  return (
    <View style={[styles.stripCell, { width: pct(width) }]}>
      <Text style={styles.stripLabel}>{label}:</Text>
      <Text style={styles.stripValue}>{dash(value)}</Text>
    </View>
  );
}

function SummaryLine({ label, value, alt }: { label: string; value: string; alt: boolean }) {
  return (
    <View style={alt ? [styles.summaryLine, styles.summaryLineAlt] : styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function CeeLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.ceeLine}>
      <Text style={styles.ceeLabel}>{label}</Text>
      <Text style={styles.ceeValue}>{dash(value)}</Text>
    </View>
  );
}

const HEAD_COLUMNS: { label: string; width: number }[] = [
  { label: "Nº", width: COLUMN_WIDTHS.num },
  { label: "CONTENEDOR", width: COLUMN_WIDTHS.contenedor },
  { label: "PRECINTO", width: COLUMN_WIDTHS.precinto },
  { label: "FORMATO", width: COLUMN_WIDTHS.formato },
  { label: "DESIGNACIÓN / MODELO", width: COLUMN_WIDTHS.modelo },
  { label: "CAL.", width: COLUMN_WIDTHS.cal },
  { label: "TONO", width: COLUMN_WIDTHS.tono },
  { label: "NRO. PALETS", width: COLUMN_WIDTHS.palets },
  { label: "CAJAS", width: COLUMN_WIDTHS.cajas },
  { label: "M2", width: COLUMN_WIDTHS.m2 },
  { label: "PESO BRUTO (KG)", width: COLUMN_WIDTHS.bruto },
];

export function PackingListDocument({
  rows,
  meta,
  orientation,
}: {
  rows: TableRow[];
  meta: InvoiceMeta;
  orientation: PdfOrientation;
}) {
  const groups = groupByContainer(rows, meta);
  const totals = computeTotals(rows, groups);
  const declaredContainers = Number.parseInt(meta.total_contenedores, 10);
  const containerCount =
    totals.contenedores || (Number.isFinite(declaredContainers) ? declaredContainers : 1);

  // The address stays on one wrapping line, exactly as the model prints it.
  const buyerLines = meta.client_address
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const legend = meta.familia_leyenda.split("\n").map((l) => l.trim()).filter(Boolean);

  let itemIndex = 0;

  return (
    <Document
      title={`Packing List ${meta.invoice_reference || ""}`.trim()}
      author={COMPANY.legalName}
      subject="Packing List"
      creator={COMPANY.legalName}
      producer={COMPANY.legalName}
    >
      <Page size="A4" orientation={orientation} style={styles.page}>
        {/* ── Brand header ── */}
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>N</Text>
          </View>
          <View>
            <Text style={styles.brandName}>{COMPANY.name}</Text>
            <Text style={styles.brandSuffix}>{COMPANY.suffix}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerRightLine}>
              {COMPANY.legalName} — NIF: {COMPANY.nif}
            </Text>
            <Text style={styles.headerRightLine}>{COMPANY.street}</Text>
            <Text style={styles.headerRightLine}>{COMPANY.city}</Text>
            <Text style={styles.headerRightLine}>{COMPANY.email}</Text>
          </View>
        </View>

        {/* ── Title band ── */}
        <View style={styles.titleBand}>
          <Text style={styles.titleText}>PACKING LIST</Text>
        </View>

        {/* ── Invoice · Buyer · Origin ── */}
        <View style={styles.panelRow}>
          <Panel title="FACTURA / INVOICE" width={33.4}>
            <Text style={styles.panelLine}>
              <Text style={styles.panelStrong}>Nº: </Text>
              {dash(meta.invoice_reference)}
            </Text>
            <Text style={styles.panelLine}>
              <Text style={styles.panelStrong}>Fecha: </Text>
              {dash(meta.invoice_date)}
            </Text>
            {meta.supplier_name.trim() ? (
              <Text style={styles.panelLine}>
                <Text style={styles.panelStrong}>Proveedor: </Text>
                {meta.supplier_name.trim()}
              </Text>
            ) : null}
          </Panel>

          <Panel title="CLIENTE / BUYER" width={33.3}>
            <Text style={styles.panelStrong}>{dash(meta.client_name)}</Text>
            {buyerLines.map((line, i) => (
              <Text key={`buyer-${i}`} style={styles.panelLine}>
                {line}
              </Text>
            ))}
            {meta.client_vat.trim() ? (
              <Text style={styles.panelLine}>VAT: {meta.client_vat.trim()}</Text>
            ) : null}
          </Panel>

          <Panel title="ORIGEN DE LA MERCANCÍA" width={33.3}>
            {meta.origen_mercancia
              .split(/\s*—\s*|\n/)
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, i) => (
                <Text key={`origin-${i}`} style={styles.panelLine}>
                  {line}
                </Text>
              ))}
          </Panel>
        </View>

        {/* ── Reference strip ── */}
        <View style={styles.stripRow}>
          <StripCell label="SU REFERENCIA" value={meta.su_referencia} width={33.4} />
          <View style={styles.stripDivider} />
          <StripCell label="FORMA DE PAGO" value={meta.forma_pago} width={33.3} />
          <View style={styles.stripDivider} />
          <StripCell label="ÚLTIMO TENEDOR" value={meta.ultimo_tenedor || meta.client_name} width={33.3} />
        </View>

        {/* ── Item grid ── */}
        <View>
          <View style={styles.headRow} fixed>
            {HEAD_COLUMNS.map((column) => (
              <Text key={column.label} style={[styles.headCell, { width: pct(column.width) }]}>
                {column.label}
              </Text>
            ))}
          </View>

          {groups.map((group) => (
            <View key={`group-${group.index}`} style={styles.group} wrap={false}>
              <View style={[styles.groupCell, { width: pct(COLUMN_WIDTHS.num) }]}>
                <Text style={styles.groupIndex}>{group.index}</Text>
              </View>
              <View style={[styles.groupCell, { width: pct(COLUMN_WIDTHS.contenedor) }]}>
                <Text style={styles.groupText}>{dash(group.contenedor)}</Text>
              </View>
              <View style={[styles.groupCell, { width: pct(COLUMN_WIDTHS.precinto) }]}>
                <Text style={styles.groupText}>{dash(group.precinto)}</Text>
              </View>

              <View style={[styles.itemBlock, { width: pct(ITEM_BLOCK_WIDTH) }]}>
                {group.rows.map((row, rowIndex) => {
                  itemIndex += 1;
                  const zebra = itemIndex % 2 === 0 ? BRAND.tint : BRAND.white;
                  return (
                    <View
                      key={row.id}
                      style={[
                        styles.itemRow,
                        rowIndex > 0 ? styles.itemDivider : {},
                        { backgroundColor: zebra },
                      ]}
                    >
                      <Text style={[styles.cell, { width: pct(ITEM_WIDTHS.formato), textAlign: "center" }]}>
                        {row.formato}
                      </Text>
                      <Text style={[styles.cell, { width: pct(ITEM_WIDTHS.modelo) }]}>{designation(row)}</Text>
                      <Text style={[styles.cell, { width: pct(ITEM_WIDTHS.cal), textAlign: "center" }]}>
                        {row.cal}
                      </Text>
                      <Text style={[styles.cell, { width: pct(ITEM_WIDTHS.tono), textAlign: "center" }]}>
                        {row.tono}
                      </Text>
                      <Text style={[styles.cell, { width: pct(ITEM_WIDTHS.palets), textAlign: "center" }]}>
                        {fmtNum(row.nro_palets)}
                      </Text>
                      <Text style={[styles.cell, { width: pct(ITEM_WIDTHS.cajas), textAlign: "center" }]}>
                        {fmtNum(row.cajas)}
                      </Text>
                      <Text style={[styles.cell, { width: pct(ITEM_WIDTHS.m2), textAlign: "center" }]}>
                        {fmtNum(row.m2)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={[styles.groupCell, { width: pct(COLUMN_WIDTHS.bruto) }]}>
                <Text style={styles.groupText}>{fmtNum(group.pesoBruto)}</Text>
              </View>
            </View>
          ))}

          {/* ── Totals ── */}
          <View style={styles.totalRow}>
            <Text
              style={[
                styles.totalLabel,
                {
                  width: pct(
                    COLUMN_WIDTHS.num +
                      COLUMN_WIDTHS.contenedor +
                      COLUMN_WIDTHS.precinto +
                      COLUMN_WIDTHS.formato +
                      COLUMN_WIDTHS.modelo +
                      COLUMN_WIDTHS.cal +
                      COLUMN_WIDTHS.tono
                  ),
                },
              ]}
            >
              TOTAL
            </Text>
            <Text style={[styles.totalValue, { width: pct(COLUMN_WIDTHS.palets) }]}>{fmtNum(totals.palets)}</Text>
            <Text style={[styles.totalValue, { width: pct(COLUMN_WIDTHS.cajas) }]}>{fmtNum(totals.cajas)}</Text>
            <Text style={[styles.totalValue, { width: pct(COLUMN_WIDTHS.m2) }]}>{fmtNum(totals.m2)}</Text>
            <Text style={[styles.totalValue, { width: pct(COLUMN_WIDTHS.bruto) }]}>{fmtNum(totals.pesoBruto)}</Text>
          </View>
        </View>

        {/* ── Summary + customs ── */}
        <View style={styles.summaryRow} wrap={false}>
          <View style={{ width: "56%" }}>
            <Text style={styles.summaryTitle}>RESUMEN DEL ENVÍO</Text>
            <SummaryLine label="Nº Contenedores:" value={String(containerCount)} alt={false} />
            <SummaryLine label="Total Palets:" value={fmtNum(totals.palets)} alt />
            <SummaryLine label="Total Cajas:" value={fmtNum(totals.cajas)} alt={false} />
            <SummaryLine label="Total M2:" value={fmtNum(totals.m2)} alt />
            {totals.piezas > 0 ? (
              <SummaryLine label="Total Piezas:" value={fmtNum(totals.piezas, 0)} alt={false} />
            ) : null}
            <SummaryLine label="Peso Neto:" value={`${fmtNum(totals.pesoNeto)} Kg`} alt />
            <SummaryLine label="Peso Bruto:" value={`${fmtNum(totals.pesoBruto)} Kg`} alt={false} />
          </View>

          <View style={styles.summaryDivider} />

          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>CÓDIGO C.E.E.</Text>
            <CeeLine label="Partida Arancelaria:" value={meta.partida_arancelaria} />
            <CeeLine label="País de Origen:" value={meta.pais_origen} />
            <CeeLine label="País de Destino:" value={meta.pais_destino} />
            {legend.map((line) => {
              const [code, ...rest] = line.split(/\s+/);
              return <CeeLine key={line} label={`Familia ${code}:`} value={rest.join(" ")} />;
            })}
          </View>
        </View>

        {/* ── Closing ── */}
        <View style={styles.originBox} wrap={false}>
          <Text style={styles.originText}>{ORIGIN_NOTE}</Text>
        </View>
        <Text style={styles.vatNote}>{VAT_NOTE}</Text>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {COMPANY.legalName} — NIF: {COMPANY.nif} — {COMPANY.street}, {COMPANY.city} — {COMPANY.email}
          </Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function buildPackingListPdfBlob(
  rows: TableRow[],
  meta: InvoiceMeta,
  orientation: PdfOrientation = "portrait"
): Promise<Blob> {
  return pdf(<PackingListDocument rows={rows} meta={meta} orientation={orientation} />).toBlob();
}

export async function exportPackingListPdf(
  rows: TableRow[],
  meta: InvoiceMeta,
  orientation: PdfOrientation = "portrait"
): Promise<void> {
  const blob = await buildPackingListPdfBlob(rows, meta, orientation);
  const reference = (meta.invoice_reference || "export").replace(/[^\w.-]+/g, "_");
  const suffix = orientation === "portrait" ? "VERTICAL" : "HORIZONTAL";
  saveAs(blob, `PACKING_LIST_${reference}_${suffix}.pdf`);
}
