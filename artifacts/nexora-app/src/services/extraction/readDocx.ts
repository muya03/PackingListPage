/**
 * DOCX reader — unzips the package and walks word/document.xml directly.
 *
 * A .docx already stores its tables as real tables, so we recover rows and
 * cells structurally instead of guessing them back from coordinates. That makes
 * DOCX the highest-fidelity input the pipeline accepts.
 */

import PizZip from "pizzip";
import { groupIntoLines } from "./lines";
import type { DocumentText, SourceDocument, TextItem } from "./types";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export async function readDocx(source: SourceDocument): Promise<DocumentText> {
  const zip = new PizZip(new Uint8Array(source.bytes));
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error(`"${source.filename}" no es un DOCX válido (falta word/document.xml).`);

  const xml = entry.asText();
  const dom = new DOMParser().parseFromString(xml, "application/xml");
  if (dom.getElementsByTagName("parsererror").length > 0) {
    throw new Error(`No se ha podido leer el contenido de "${source.filename}".`);
  }

  const body = dom.getElementsByTagNameNS(W_NS, "body")[0] ?? dom.documentElement;

  const nativeTables: string[][][] = [];
  const textLines: string[] = [];
  const items: TextItem[] = [];
  let line = 0;

  // Walk the body in document order so paragraphs and tables stay interleaved.
  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType !== 1) continue;
    const el = node as Element;

    if (el.localName === "tbl") {
      // A table nested in a cell is a table of its own, not extra paragraphs of
      // the cell that holds it.
      // Queue grows as deeper tables are discovered, so this covers any depth.
      const queue: Element[] = [el];
      for (let i = 0; i < queue.length; i++) {
        const cells = readTable(queue[i], queue);
        if (cells.length === 0) continue;
        nativeTables.push(cells.map((row) => row.map((cell) => cell.join(" ").trim())));
        line = layoutTable(cells, items, textLines, line);
      }
    } else if (el.localName === "p") {
      const text = readParagraph(el).trim();
      if (!text) continue;
      items.push(makeItem(text, 0, line));
      textLines.push(text);
      line += 1;
    }
  }

  const plainText = textLines.join("\n");

  return {
    filename: source.filename,
    role: source.role,
    kind: "docx",
    pages: [{ pageNumber: 1, width: 595, height: 842, items, lines: groupIntoLines(items, 1) }],
    plainText,
    nativeTables,
    isScanned: plainText.trim().length < 40,
  };
}

/**
 * Horizontal pitch between cells. Cell text is capped well short of the pitch
 * so the gap between two columns always reads as a column break rather than a
 * word space, whatever the cell contains.
 */
const COLUMN_PITCH = 160;
const MAX_CELL_WIDTH = 100;
const LINE_PITCH = 12;

function makeItem(text: string, column: number, line: number): TextItem {
  return {
    text,
    x: column * COLUMN_PITCH,
    y: line * LINE_PITCH,
    width: Math.min(text.length * 3.4, MAX_CELL_WIDTH),
    height: 10,
  };
}

/**
 * Places a table on the synthetic page. Each cell paragraph gets its own line
 * inside the row, which is what lets a label in one cell find the value printed
 * under it — the same relationship the PDF reader sees from real coordinates.
 */
function layoutTable(rows: string[][][], items: TextItem[], textLines: string[], startLine: number): number {
  let line = startLine;
  for (const row of rows) {
    const depth = Math.max(1, ...row.map((cell) => cell.length));
    for (let sub = 0; sub < depth; sub++) {
      const parts: string[] = [];
      row.forEach((cell, column) => {
        const text = (cell[sub] ?? "").trim();
        parts.push(text);
        if (text) items.push(makeItem(text, column, line + sub));
      });
      const joined = parts.join("\t").trim();
      if (joined) textLines.push(parts.join("\t"));
    }
    line += depth;
  }
  return line;
}

/**
 * Rows → cells → the paragraphs inside each cell. Tables found inside a cell
 * are pushed onto `nested` instead of being flattened into its paragraphs.
 */
function readTable(tbl: Element, nested: Element[]): string[][][] {
  const rows: string[][][] = [];
  for (const trNode of Array.from(tbl.childNodes)) {
    if (trNode.nodeType !== 1) continue;
    const tr = trNode as Element;
    if (tr.localName !== "tr") continue;

    const cells: string[][] = [];
    for (const tcNode of Array.from(tr.childNodes)) {
      if (tcNode.nodeType !== 1) continue;
      const tc = tcNode as Element;
      if (tc.localName !== "tc") continue;

      const paragraphs: string[] = [];
      for (const child of Array.from(tc.childNodes)) {
        if (child.nodeType !== 1) continue;
        const node = child as Element;
        if (node.localName === "p") {
          const text = readParagraph(node).replace(/\s+/g, " ").trim();
          if (text) paragraphs.push(text);
        } else if (node.localName === "tbl") {
          nested.push(node);
        }
      }
      cells.push(paragraphs);

      // A horizontally merged cell covers the columns it spans.
      const span = getGridSpan(tc);
      for (let i = 1; i < span; i++) cells.push([]);
    }
    if (cells.some((c) => c.length > 0)) rows.push(cells);
  }
  return rows;
}

function getGridSpan(tc: Element): number {
  const span = tc.getElementsByTagNameNS(W_NS, "gridSpan")[0];
  const value = span?.getAttributeNS(W_NS, "val") ?? span?.getAttribute("w:val");
  const parsed = value ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readParagraph(p: Element): string {
  const parts: string[] = [];
  for (const t of Array.from(p.getElementsByTagNameNS(W_NS, "t"))) {
    parts.push(t.textContent ?? "");
  }
  return parts.join("");
}
