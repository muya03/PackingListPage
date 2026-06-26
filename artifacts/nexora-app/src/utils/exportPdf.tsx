import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import type { TableRow, InvoiceMeta } from "@/types/packing";

const fmtNum = (n: number, d = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const C = {
  black: "#000000",
  darkGray: "#333333",
  midGray: "#666666",
  lightGray: "#CCCCCC",
  headerBg: "#CCCCCC",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    fontSize: 7,
    fontFamily: "Helvetica",
    padding: 24,
    backgroundColor: C.white,
    color: C.black,
  },
  // Company header
  companyName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  companyLine: { fontSize: 8, marginBottom: 1 },
  spacer: { height: 10 },
  spacerSm: { height: 5 },
  // Info two-column block
  infoRow: { flexDirection: "row", marginBottom: 8 },
  infoLeft: { flex: 6 },
  infoRight: { flex: 4 },
  plTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  infoLine: { flexDirection: "row", marginBottom: 2 },
  infoLabel: { fontFamily: "Helvetica-Bold", fontSize: 7, width: 90 },
  infoValue: { fontSize: 7, flex: 1 },
  infoDestLabel: { fontFamily: "Helvetica-Bold", fontSize: 7, marginBottom: 3 },
  infoDestValue: { fontSize: 7, marginBottom: 1 },
  // Container line
  containerLine: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8, fontSize: 7 },
  containerLabel: { fontFamily: "Helvetica-Bold", marginRight: 4 },
  containerValue: { marginRight: 14 },
  // Table
  table: { marginBottom: 6 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: C.headerBg },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.lightGray },
  tableRowAlt: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.lightGray, backgroundColor: "#F8F8F8" },
  tableTotalRow: { flexDirection: "row", borderTopWidth: 1.5, borderTopColor: C.black, backgroundColor: "#F0F0F0" },
  thCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    borderWidth: 0.5,
    borderColor: C.black,
    paddingVertical: 2,
    paddingHorizontal: 1,
    textAlign: "center",
  },
  tdCell: {
    fontSize: 6.5,
    borderWidth: 0.5,
    borderColor: C.lightGray,
    paddingVertical: 2,
    paddingHorizontal: 1,
    textAlign: "center",
  },
  tdTotalCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.5,
    borderWidth: 0.5,
    borderColor: C.black,
    paddingVertical: 2,
    paddingHorizontal: 1,
    textAlign: "center",
  },
  // Summary
  summaryBlock: { marginTop: 8, marginBottom: 6 },
  summaryLine: { flexDirection: "row", marginBottom: 2 },
  summaryLabel: { fontFamily: "Helvetica-Bold", fontSize: 7, width: 130 },
  summaryValue: { fontSize: 7 },
  // Legend
  legendLine: { fontSize: 7, marginBottom: 1 },
  // CEE table
  ceeBlock: { marginTop: 8, marginBottom: 6 },
  // VAT note
  vatNote: { fontSize: 6.5, color: C.darkGray, marginTop: 10, marginBottom: 6 },
  // Footer
  footer: { textAlign: "center", fontSize: 6.5, color: C.midGray, marginTop: 8 },
});

// Column widths (relative flex or fixed points)
const COL = {
  fam: 22,
  formato: 52,
  modelo: 54,
  color: 40,
  cal: 22,
  tono: 30,
  clbr: 20,
  nro_palets: 30,
  m2: 30,
  piezas: 28,
  cajas: 28,
  peso_neto: 40,
  peso_bruto: 42,
};

function Th({ children, w }: { children: string; w: number }) {
  return <Text style={[styles.thCell, { width: w }]}>{children}</Text>;
}
function Td({ children, w, left }: { children: string; w: number; left?: boolean }) {
  return <Text style={[styles.tdCell, { width: w, textAlign: left ? "left" : "center" }]}>{children}</Text>;
}
function TdTotal({ children, w }: { children: string; w: number }) {
  return <Text style={[styles.tdTotalCell, { width: w }]}>{children}</Text>;
}

function PackingListDoc({ rows, meta }: { rows: TableRow[]; meta: InvoiceMeta }) {
  const totalPalets = rows.reduce((s, r) => s + r.nro_palets, 0);
  const totalM2 = rows.reduce((s, r) => s + r.m2, 0);
  const totalPiezas = rows.reduce((s, r) => s + r.piezas, 0);
  const totalCajas = rows.reduce((s, r) => s + r.cajas, 0);
  const totalPesoNeto = rows.reduce((s, r) => s + r.peso_neto, 0);
  const totalPesoBruto = rows.reduce((s, r) => s + r.peso_bruto, 0);

  const destinatario = [meta.client_name, meta.client_address].filter(Boolean).join(", ");

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* 1. Company header */}
        <Text style={styles.companyName}>Nexora Ceramica S.L  B24881047</Text>
        <Text style={styles.companyLine}>AVENIDA DEL MEDITERRÁNEO, 87, NAVE 3, ONDA</Text>
        <View style={styles.spacer} />

        {/* 2. Two-column info block */}
        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Text style={styles.plTitle}>PACKING LIST</Text>
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>NUMERO FACTURA</Text>
              <Text style={styles.infoValue}>{meta.invoice_reference}</Text>
            </View>
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>FECHA FACTURA</Text>
              <Text style={styles.infoValue}>{meta.invoice_date}</Text>
            </View>
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>CLIENTE</Text>
              <Text style={styles.infoValue}>{meta.client_name}</Text>
            </View>
            <View style={styles.infoLine}>
              <Text style={styles.infoLabel}>V.A.T</Text>
              <Text style={styles.infoValue}>{meta.client_vat}</Text>
            </View>
          </View>
          <View style={styles.infoRight}>
            <Text style={styles.infoDestLabel}>COMPRADOR - DESTINATARIO</Text>
            {destinatario.split(",").map((part, i) => (
              <Text key={i} style={styles.infoDestValue}>{part.trim()}</Text>
            ))}
          </View>
        </View>

        {/* 3. Container info */}
        {(meta.contenedor || meta.precinto) && (
          <View style={styles.containerLine}>
            <Text style={styles.containerLabel}>CONTENEDOR</Text>
            <Text style={styles.containerValue}>{meta.contenedor}</Text>
            <Text style={styles.containerLabel}>PRECINTO</Text>
            <Text style={styles.containerValue}>{meta.precinto}</Text>
            <Text style={styles.containerLabel}>PESO NETO</Text>
            <Text style={styles.containerValue}>{fmtNum(totalPesoNeto)}</Text>
            <Text style={styles.containerLabel}>PESO BRUTO</Text>
            <Text>{fmtNum(totalPesoBruto)}</Text>
          </View>
        )}

        {/* 4. Main data table */}
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableHeaderRow}>
            <Th w={COL.fam}>FAM</Th>
            <Th w={COL.formato}>FORMATO</Th>
            <Th w={COL.modelo}>MODELO</Th>
            <Th w={COL.color}>COLOR</Th>
            <Th w={COL.cal}>CAL</Th>
            <Th w={COL.tono}>TONO</Th>
            <Th w={COL.clbr}>CLBR</Th>
            <Th w={COL.nro_palets}>NRO.PALETS</Th>
            <Th w={COL.m2}>M2</Th>
            <Th w={COL.piezas}>PIEZAS</Th>
            <Th w={COL.cajas}>CAJAS</Th>
            <Th w={COL.peso_neto}>PESO NETO</Th>
            <Th w={COL.peso_bruto}>PESO BRUTO</Th>
          </View>
          {/* Rows */}
          {rows.map((r, i) => (
            <View key={r.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Td w={COL.fam}>{r.fam}</Td>
              <Td w={COL.formato} left>{r.formato}</Td>
              <Td w={COL.modelo} left>{r.modelo}</Td>
              <Td w={COL.color} left>{r.color}</Td>
              <Td w={COL.cal}>{r.cal}</Td>
              <Td w={COL.tono}>{r.tono}</Td>
              <Td w={COL.clbr}>{r.clbr}</Td>
              <Td w={COL.nro_palets}>{String(r.nro_palets)}</Td>
              <Td w={COL.m2}>{fmtNum(r.m2)}</Td>
              <Td w={COL.piezas}>{String(r.piezas)}</Td>
              <Td w={COL.cajas}>{String(r.cajas)}</Td>
              <Td w={COL.peso_neto}>{fmtNum(r.peso_neto)}</Td>
              <Td w={COL.peso_bruto}>{fmtNum(r.peso_bruto)}</Td>
            </View>
          ))}
          {/* Totals */}
          <View style={styles.tableTotalRow}>
            <TdTotal w={COL.fam}>{""}</TdTotal>
            <TdTotal w={COL.formato}>{""}</TdTotal>
            <TdTotal w={COL.modelo}>{""}</TdTotal>
            <TdTotal w={COL.color}>{""}</TdTotal>
            <TdTotal w={COL.cal}>{""}</TdTotal>
            <TdTotal w={COL.tono}>{""}</TdTotal>
            <TdTotal w={COL.clbr}>{""}</TdTotal>
            <TdTotal w={COL.nro_palets}>{String(totalPalets)}</TdTotal>
            <TdTotal w={COL.m2}>{fmtNum(totalM2)}</TdTotal>
            <TdTotal w={COL.piezas}>{String(totalPiezas)}</TdTotal>
            <TdTotal w={COL.cajas}>{String(totalCajas)}</TdTotal>
            <TdTotal w={COL.peso_neto}>{fmtNum(totalPesoNeto)}</TdTotal>
            <TdTotal w={COL.peso_bruto}>{fmtNum(totalPesoBruto)}</TdTotal>
          </View>
        </View>

        {/* 5. Summary */}
        <View style={styles.summaryBlock}>
          <View style={styles.summaryLine}><Text style={styles.summaryLabel}>PESO BRUTO (Kg)</Text><Text style={styles.summaryValue}>{fmtNum(totalPesoBruto)}</Text></View>
          <View style={styles.summaryLine}><Text style={styles.summaryLabel}>PESO NETO (Kg)</Text><Text style={styles.summaryValue}>{fmtNum(totalPesoNeto)}</Text></View>
          <View style={styles.summaryLine}><Text style={styles.summaryLabel}>TOTAL PALETS</Text><Text style={styles.summaryValue}>{String(totalPalets)}</Text></View>
          <View style={styles.summaryLine}><Text style={styles.summaryLabel}>TOTAL CONTENEDORES</Text><Text style={styles.summaryValue}>{meta.total_contenedores || "1"}</Text></View>
        </View>

        {/* 6. Family legend */}
        {meta.familia_leyenda && (
          <View>
            {meta.familia_leyenda.split("\n").filter(Boolean).map((line, i) => (
              <Text key={i} style={styles.legendLine}>{line.trim()}</Text>
            ))}
          </View>
        )}

        {/* 7. CEE codes table */}
        {meta.codigo_cee && (
          <View style={styles.ceeBlock}>
            <View style={styles.tableHeaderRow}>
              <Th w={200}>{meta.codigo_cee.length > 40 ? meta.codigo_cee.substring(0, 40) + "…" : meta.codigo_cee}</Th>
              <Th w={50}>M2</Th>
              <Th w={70}>PESO BRUTO</Th>
              <Th w={70}>PESO NETO</Th>
              <Th w={50}>PALETS</Th>
            </View>
            <View style={styles.tableRow}>
              <Td w={200} left>{meta.codigo_cee}</Td>
              <Td w={50}>{fmtNum(totalM2)}</Td>
              <Td w={70}>{fmtNum(totalPesoBruto)}</Td>
              <Td w={70}>{fmtNum(totalPesoNeto)}</Td>
              <Td w={50}>{String(totalPalets)}</Td>
            </View>
          </View>
        )}

        {/* 8. VAT note */}
        <Text style={styles.vatNote}>
          Operacion exenta de IVA de conformidad al articulo 21 de la Ley 37/1992 del Impuesto sobre el valor Añadido
        </Text>

        {/* 9. Footer */}
        <Text style={styles.footer}>info@nexoraceramica.es</Text>
        <Text style={styles.footer}>Page   1/1</Text>
      </Page>
    </Document>
  );
}

export async function exportPackingListPdf(
  rows: TableRow[],
  meta: InvoiceMeta
): Promise<void> {
  const blob = await pdf(<PackingListDoc rows={rows} meta={meta} />).toBlob();
  saveAs(blob, `PackingList_NEXORA_${meta.invoice_reference || "export"}.pdf`);
}
