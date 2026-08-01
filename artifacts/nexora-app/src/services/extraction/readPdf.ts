/**
 * PDF reader built on pdf.js — runs entirely in the browser, no API calls.
 *
 * Digital PDFs (which is what ERPs emit) carry a real text layer with exact
 * glyph positions; that is all the deterministic pipeline needs. When a PDF
 * turns out to be a scan we say so and let the caller decide whether to fall
 * back to the vision model.
 */

import * as pdfjs from "pdfjs-dist";
import type { TextItem as PdfjsTextItem } from "pdfjs-dist/types/src/display/api";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { groupIntoLines } from "./lines";
import type { DocumentText, PageText, SourceDocument, TextItem } from "./types";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Below this many characters per page the file is treated as a scan. */
const SCAN_CHAR_THRESHOLD = 40;

export async function readPdf(source: SourceDocument): Promise<DocumentText> {
  const task = pdfjs.getDocument({
    data: new Uint8Array(source.bytes.slice(0)),
    useSystemFonts: true,
  });
  const doc = await task.promise;

  const pages: PageText[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      const items: TextItem[] = [];
      for (const raw of content.items) {
        const item = raw as PdfjsTextItem;
        if (typeof item.str !== "string" || !item.str.trim()) continue;
        const [, , , , e, f] = item.transform;
        const height = Math.abs(item.height) || 8;
        items.push({
          text: item.str,
          x: e,
          // pdf.js origin is bottom-left; the pipeline reads top-down.
          y: viewport.height - f,
          width: item.width || item.str.length * height * 0.5,
          height,
        });
      }

      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        items,
        lines: groupIntoLines(items),
      });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }

  const plainText = pages
    .map((p) => p.lines.map((l) => l.text).join("\n"))
    .join("\n");

  const avgCharsPerPage = pages.length ? plainText.length / pages.length : 0;

  return {
    filename: source.filename,
    role: source.role,
    kind: "pdf",
    pages,
    plainText,
    nativeTables: [],
    isScanned: avgCharsPerPage < SCAN_CHAR_THRESHOLD,
  };
}
