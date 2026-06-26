/**
 * OpenAI service using the Responses API (/v1/responses).
 *
 * Extracts ceramic tile packing list data from supplier invoices/packing lists.
 * Fields match NEXORA CERAMICA's format: FAM, FORMATO, MODELO, COLOR, CAL, TONO,
 * CLBR, NRO.PALETS, M2, PIEZAS, CAJAS, PESO NETO, PESO BRUTO.
 */

import { InvoiceResponseSchema, type InvoiceResponse } from "@/types/packing";

export interface PdfFile {
  base64: string;
  filename: string;
  role: string;
}

const OPENAI_JSON_SCHEMA = {
  type: "json_schema" as const,
  name: "packing_list_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      invoice_reference: { type: "string" },
      invoice_date: { type: "string" },
      supplier_name: { type: "string" },
      client_name: { type: "string" },
      client_vat: { type: "string" },
      client_address: { type: "string" },
      contenedor: { type: "string" },
      precinto: { type: "string" },
      familia_leyenda: { type: "string" },
      codigo_cee: { type: "string" },
      total_contenedores: { type: "string" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            fam: { type: "string" },
            formato: { type: "string" },
            modelo: { type: "string" },
            color: { type: "string" },
            cal: { type: "string" },
            tono: { type: "string" },
            clbr: { type: "string" },
            nro_palets: { type: "number" },
            m2: { type: "number" },
            piezas: { type: "number" },
            cajas: { type: "number" },
            peso_neto: { type: "number" },
            peso_bruto: { type: "number" },
            source_file: { type: "string" },
          },
          required: [
            "fam", "formato", "modelo", "color", "cal", "tono", "clbr",
            "nro_palets", "m2", "piezas", "cajas", "peso_neto", "peso_bruto",
            "source_file",
          ],
          additionalProperties: false,
        },
      },
    },
    required: [
      "invoice_reference", "invoice_date", "supplier_name", "client_name",
      "client_vat", "client_address", "contenedor", "precinto",
      "familia_leyenda", "codigo_cee", "total_contenedores", "items",
    ],
    additionalProperties: false,
  },
};

const SYSTEM_INSTRUCTIONS = `Eres un experto en logística de exportación de NEXORA CERAMICA S.L., empresa exportadora de revestimientos y gres porcelánico.

Tu misión es analizar los documentos proporcionados (factura comercial y/o packing list de azulejos/gres) y extraer todos los datos en el formato de packing list de NEXORA.

## CAMPOS A EXTRAER

### CABECERA DEL DOCUMENTO
- invoice_reference: Número de factura (ej: "INV/2026/00003")
- invoice_date: Fecha de factura en formato DD/MM/YYYY
- supplier_name: Nombre y NIF del proveedor/exportador
- client_name: Nombre completo del cliente/importador
- client_vat: NIF/VAT del cliente
- client_address: Dirección completa del destinatario (ciudad, país)
- contenedor: Número de contenedor (ej: "MSNU-707903/3")
- precinto: Número de precinto/sello del contenedor (ej: "FX39609376")
- familia_leyenda: Leyenda de familias de producto, una por línea (ej: "082 SLIM MATE\n084 SLIM PULIDO")
- codigo_cee: Código arancelario CEE con descripción (ej: "69072100-COEFICIENTE ABSORCION <=0,5%")
- total_contenedores: Número total de contenedores como string (ej: "1")

### LÍNEAS DE PRODUCTO
Para cada línea de artículo en el packing list extrae:
- fam: Código de familia (ej: "082", "084") — normalmente los primeros 3 dígitos del código de artículo o referencia
- formato: Dimensiones del formato de la losa (ej: "324x162(12+)", "324x162(12mm)")
- modelo: Nombre del modelo/serie (ej: "AS.ARMANI", "AS.ONICE")
- color: Color del modelo (ej: "SILVER", "BLUE", "WHITE")
- cal: Calidad (ej: "C.E", "1ª", "2ª")
- tono: Código de tono/lote (ej: "XX16X", "H16", "AH09")
- clbr: Calibre, normalmente un número (ej: "0", "1", "2")
- nro_palets: Número de palets para esta línea (número entero)
- m2: Metros cuadrados de esta línea (número decimal)
- piezas: Número de piezas de esta línea (número entero)
- cajas: Número de cajas de esta línea (igual a piezas en losas grandes)
- peso_neto: Peso neto en kg de esta línea (número decimal con 2 decimales)
- peso_bruto: Peso bruto en kg de esta línea (número decimal con 2 decimales)
- source_file: Nombre exacto del archivo PDF de origen

## INSTRUCCIONES IMPORTANTES
- NO incluyas filas de totales ni subtotales como ítems individuales
- Extrae TODAS las líneas de producto, incluyendo las que tienen nro_palets = 0
- Para campos no presentes en el documento, devuelve cadena vacía "" o 0 según corresponda
- Los valores numéricos deben ser números (sin comas de miles), con hasta 2 decimales
- Si hay múltiples documentos, reconcílalos en una única lista sin duplicados
- El campo source_file debe contener el nombre exacto del archivo PDF

## INSTRUCCIONES PARA MÚLTIPLES DOCUMENTOS
Si recibes más de un documento (factura + packing list):
- Reconcilia ambos en una lista unificada de ítems
- Para cada ítem indica el campo source_file con el nombre exacto del archivo de origen
- Los metadatos de cabecera extráelos preferentemente de la factura comercial`;

export async function extractInvoiceData(
  files: PdfFile[],
  apiKey: string
): Promise<InvoiceResponse> {
  if (files.length === 0) throw new Error("No se proporcionaron archivos PDF.");

  const fileInputs = files.map((f) => ({
    type: "input_file" as const,
    filename: f.filename,
    file_data: `data:application/pdf;base64,${f.base64}`,
  }));

  const fileDescriptions = files
    .map((f) => `- "${f.filename}" → ${f.role}`)
    .join("\n");

  const textPrompt =
    files.length > 1
      ? `Analiza estos ${files.length} documentos PDF y reconcílalos en una única lista de ítems. Los archivos son:\n${fileDescriptions}\n\nExtrae todos los datos del packing list de azulejos/gres en el formato indicado.`
      : `Analiza este documento PDF (${files[0]?.role ?? "packing list"}) y extrae todos los datos del packing list de azulejos/gres. El campo source_file debe contener el nombre del archivo: "${files[0]?.filename}".`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-2024-08-06",
      instructions: SYSTEM_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            ...fileInputs,
            { type: "input_text", text: textPrompt },
          ],
        },
      ],
      text: { format: OPENAI_JSON_SCHEMA },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage =
      (errorData as { error?: { message?: string } }).error?.message ||
      `Error HTTP ${response.status}`;
    throw new Error(`Error de OpenAI: ${errorMessage}`);
  }

  const data = await response.json();
  const content =
    data.output?.[0]?.content?.[0]?.text ?? data.output_text ?? null;

  if (!content) {
    throw new Error("La respuesta de OpenAI no contiene datos válidos.");
  }

  const parsed = JSON.parse(content);
  const validated = InvoiceResponseSchema.safeParse(parsed);

  if (!validated.success) {
    console.error("Validation error:", validated.error);
    throw new Error(
      "Los datos extraídos no son válidos. Por favor revisa el documento."
    );
  }

  return validated.data;
}
