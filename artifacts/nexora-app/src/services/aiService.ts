/**
 * OpenAI integration — deliberately reduced to the two jobs the deterministic
 * pipeline genuinely cannot do:
 *
 *  1. `aiReadScan`   — a photo or a scanned PDF has no text layer at all, so
 *                      something has to look at the pixels.
 *  2. `aiVerify`     — a cheap text-only second opinion the operator can ask
 *                      for when the document's own totals do not add up.
 *
 * Everything else (digital PDFs, DOCX, column mapping, unit conversion, totals)
 * is handled offline in `services/extraction`. The API key is optional: without
 * one the application still works end to end.
 */

import { InvoiceResponseSchema, type InvoiceResponse, type TableRow } from "@/types/packing";
import type { DocumentText, ExtractionIssue, SourceDocument } from "@/services/extraction";
import { fmtNum } from "@/services/extraction";

/** Vision is only needed for pixels; it is the expensive path. */
const VISION_MODEL = "gpt-4o-2024-08-06";
/** Verification and text-only rescue run on the small model. */
const TEXT_MODEL = "gpt-4o-mini";

const OPENAI_URL = "https://api.openai.com/v1/responses";

const ITEM_PROPERTIES = {
  fam: { type: "string" },
  formato: { type: "string" },
  modelo: { type: "string" },
  color: { type: "string" },
  cal: { type: "string" },
  tono: { type: "string" },
  clbr: { type: "string" },
  contenedor: { type: "string" },
  precinto: { type: "string" },
  nro_palets: { type: "number" },
  m2: { type: "number" },
  piezas: { type: "number" },
  cajas: { type: "number" },
  peso_neto: { type: "number" },
  peso_bruto: { type: "number" },
  source_file: { type: "string" },
} as const;

const EXTRACTION_SCHEMA = {
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
      su_referencia: { type: "string" },
      forma_pago: { type: "string" },
      ultimo_tenedor: { type: "string" },
      origen_mercancia: { type: "string" },
      partida_arancelaria: { type: "string" },
      pais_origen: { type: "string" },
      pais_destino: { type: "string" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: ITEM_PROPERTIES,
          required: Object.keys(ITEM_PROPERTIES),
          additionalProperties: false,
        },
      },
    },
    required: [
      "invoice_reference", "invoice_date", "supplier_name", "client_name", "client_vat",
      "client_address", "contenedor", "precinto", "familia_leyenda", "codigo_cee",
      "total_contenedores", "su_referencia", "forma_pago", "ultimo_tenedor",
      "origen_mercancia", "partida_arancelaria", "pais_origen", "pais_destino", "items",
    ],
    additionalProperties: false,
  },
};

const VERIFY_SCHEMA = {
  type: "json_schema" as const,
  name: "packing_list_verification",
  strict: true,
  schema: {
    type: "object",
    properties: {
      veredicto: { type: "string", enum: ["correcto", "con_discrepancias"] },
      resumen: { type: "string" },
      hallazgos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            linea: { type: "integer", description: "Índice de línea empezando en 1; 0 para la cabecera." },
            campo: { type: "string" },
            valor_actual: { type: "string" },
            valor_documento: { type: "string" },
            explicacion: { type: "string" },
          },
          required: ["linea", "campo", "valor_actual", "valor_documento", "explicacion"],
          additionalProperties: false,
        },
      },
    },
    required: ["veredicto", "resumen", "hallazgos"],
    additionalProperties: false,
  },
};

const EXTRACTION_INSTRUCTIONS = `Eres el departamento de logística de exportación de NEXORA CERAMICA S.L.

Lees packing lists y facturas de azulejos/gres y devuelves los datos tal y como aparecen en el documento.

REGLAS
- Transcribe, no interpretes: copia los valores exactamente como están impresos.
- No incluyas filas de totales, subtotales ni cabeceras como si fueran artículos.
- Números sin separador de miles y con punto decimal (1545.00, no 1.545,00).
- Si un campo no aparece en el documento, devuelve "" o 0. No lo inventes.
- contenedor: número ISO del contenedor (4 letras + dígitos). precinto: número de sello.
- Si un grupo de líneas comparte contenedor y precinto, repítelos en cada línea del grupo.
- modelo: designación comercial completa. color: solo si va en columna aparte.
- source_file: el nombre exacto del archivo del que procede la línea.`;

const VERIFY_INSTRUCTIONS = `Eres un auditor de documentos de exportación de NEXORA CERAMICA S.L.

Recibes (a) el texto literal de un documento de origen y (b) la tabla que se ha extraído de él automáticamente.

Tu única tarea es comprobar si la tabla refleja el documento. NO recalcules nada ni apliques criterios propios.

REGLAS
- Señala solo diferencias reales y comprobables contra el texto del documento.
- Para cada hallazgo indica la línea, el campo, el valor de la tabla y el valor que aparece en el documento.
- Si no encuentras diferencias, devuelve veredicto "correcto" y hallazgos vacío.
- Ignora diferencias de formato de número o de mayúsculas: no son hallazgos.`;

export interface AiFinding {
  linea: number;
  campo: string;
  valor_actual: string;
  valor_documento: string;
  explicacion: string;
}

export interface AiVerification {
  veredicto: "correcto" | "con_discrepancias";
  resumen: string;
  hallazgos: AiFinding[];
}

async function callOpenAI(
  apiKey: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      (errorData as { error?: { message?: string } }).error?.message ?? `Error HTTP ${response.status}`;
    throw new Error(`Error de OpenAI: ${message}`);
  }

  const data = await response.json();
  const content = extractOutputText(data);
  if (!content) throw new Error("La respuesta de OpenAI no contiene datos.");
  return content;
}

function extractOutputText(data: unknown): string | null {
  const payload = data as {
    output_text?: string;
    output?: { content?: { text?: string; type?: string }[] }[];
  };
  if (typeof payload.output_text === "string" && payload.output_text) return payload.output_text;
  for (const block of payload.output ?? []) {
    for (const part of block.content ?? []) {
      if (typeof part.text === "string" && part.text) return part.text;
    }
  }
  return null;
}

/**
 * Vision fallback for documents with no text layer. This is the only place the
 * raw file is uploaded, and only for the files that actually need it.
 */
export async function aiReadScan(
  sources: SourceDocument[],
  apiKey: string,
  signal?: AbortSignal
): Promise<InvoiceResponse> {
  if (sources.length === 0) throw new Error("No hay documentos que leer.");

  const fileInputs = sources.map((source) =>
    source.kind === "image"
      ? { type: "input_image" as const, image_url: `data:${imageMime(source.filename)};base64,${source.base64}`, detail: "high" as const }
      : { type: "input_file" as const, filename: source.filename, file_data: `data:application/pdf;base64,${source.base64}` }
  );

  const description = sources.map((s) => `- "${s.filename}" → ${s.role}`).join("\n");
  const content = await callOpenAI(
    apiKey,
    {
      model: VISION_MODEL,
      instructions: EXTRACTION_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            ...fileInputs,
            {
              type: "input_text",
              text: `Estos documentos son imágenes o escaneos sin capa de texto:\n${description}\n\nTranscribe la tabla de artículos y los datos de cabecera.`,
            },
          ],
        },
      ],
      text: { format: EXTRACTION_SCHEMA },
    },
    signal
  );

  return parseExtraction(content);
}

/**
 * Text-only rescue: the file had a text layer but its table could not be
 * recognised. Sending the extracted text instead of the file keeps this at a
 * fraction of the cost of the vision call.
 */
export async function aiReadText(
  documents: DocumentText[],
  apiKey: string,
  signal?: AbortSignal
): Promise<InvoiceResponse> {
  const body = documents
    .map((doc) => `### ARCHIVO: ${doc.filename} (${doc.role})\n${truncate(doc.plainText, 24000)}`)
    .join("\n\n");

  const content = await callOpenAI(
    apiKey,
    {
      model: TEXT_MODEL,
      instructions: EXTRACTION_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Texto literal extraído de los documentos. Reconstruye la tabla de artículos y la cabecera.\n\n${body}`,
            },
          ],
        },
      ],
      text: { format: EXTRACTION_SCHEMA },
    },
    signal
  );

  return parseExtraction(content);
}

/** Cross-checks the extracted table against the document text. Text-only. */
export async function aiVerify(
  rows: TableRow[],
  documents: DocumentText[],
  apiKey: string,
  signal?: AbortSignal
): Promise<AiVerification> {
  const table = rowsToTsv(rows);
  const body = documents
    .filter((doc) => doc.plainText.trim())
    .map((doc) => `### ARCHIVO: ${doc.filename} (${doc.role})\n${truncate(doc.plainText, 20000)}`)
    .join("\n\n");

  if (!body) throw new Error("No hay texto de origen contra el que verificar.");

  const content = await callOpenAI(
    apiKey,
    {
      model: TEXT_MODEL,
      instructions: VERIFY_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `## DOCUMENTOS DE ORIGEN\n${body}\n\n## TABLA EXTRAÍDA\n${table}\n\nComprueba la tabla contra los documentos.`,
            },
          ],
        },
      ],
      text: { format: VERIFY_SCHEMA },
    },
    signal
  );

  const parsed = JSON.parse(content) as AiVerification;
  return {
    veredicto: parsed.veredicto === "correcto" ? "correcto" : "con_discrepancias",
    resumen: String(parsed.resumen ?? ""),
    hallazgos: Array.isArray(parsed.hallazgos) ? parsed.hallazgos : [],
  };
}

export function verificationToIssues(verification: AiVerification): ExtractionIssue[] {
  if (verification.veredicto === "correcto") {
    return [{ level: "info", message: `IA: ${verification.resumen || "sin discrepancias."}` }];
  }
  return verification.hallazgos.map((finding) => ({
    level: "warning" as const,
    field: finding.campo,
    message:
      finding.linea > 0
        ? `IA · Línea ${finding.linea} · ${finding.campo}: la tabla dice "${finding.valor_actual}" y el documento "${finding.valor_documento}". ${finding.explicacion}`
        : `IA · ${finding.campo}: la tabla dice "${finding.valor_actual}" y el documento "${finding.valor_documento}". ${finding.explicacion}`,
  }));
}

function parseExtraction(content: string): InvoiceResponse {
  const parsed = InvoiceResponseSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    throw new Error("Los datos devueltos por la IA no tienen el formato esperado.");
  }
  return parsed.data;
}

function rowsToTsv(rows: TableRow[]): string {
  const header = [
    "LINEA", "CONTENEDOR", "PRECINTO", "FAM", "FORMATO", "MODELO", "COLOR",
    "CAL", "TONO", "CLBR", "PALETS", "M2", "PIEZAS", "CAJAS", "PESO_NETO", "PESO_BRUTO",
  ].join("\t");

  const body = rows.map((row, index) =>
    [
      index + 1, row.contenedor, row.precinto, row.fam, row.formato, row.modelo, row.color,
      row.cal, row.tono, row.clbr, row.nro_palets, fmtNum(row.m2), row.piezas, row.cajas,
      fmtNum(row.peso_neto), fmtNum(row.peso_bruto),
    ].join("\t")
  );

  return [header, ...body].join("\n");
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}\n…[texto truncado]`;
}

function imageMime(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
