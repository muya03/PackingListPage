/**
 * Geometry helpers: turn a bag of positioned text runs into ordered lines,
 * and merge runs that a PDF producer split mid-word.
 */

import type { TextItem, TextLine } from "./types";

/** Vertical distance under which two runs are considered the same line. */
const DEFAULT_Y_TOLERANCE = 2.4;

/** Horizontal gap under which two runs on a line are glued without a space. */
const GLUE_GAP = 0.6;

export function groupIntoLines(items: TextItem[], yTolerance = DEFAULT_Y_TOLERANCE): TextLine[] {
  const usable = items.filter((it) => it.text.trim().length > 0);
  if (usable.length === 0) return [];

  const sorted = [...usable].sort((a, b) => a.y - b.y || a.x - b.x);
  const buckets: TextItem[][] = [];
  let current: TextItem[] = [sorted[0]];
  let reference = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    // Tall rows (merged cells) need a tolerance proportional to the glyph size.
    const tolerance = Math.max(yTolerance, Math.min(item.height, 12) * 0.45);
    if (Math.abs(item.y - reference) <= tolerance) {
      current.push(item);
    } else {
      buckets.push(current);
      current = [item];
      reference = item.y;
    }
  }
  buckets.push(current);

  return buckets.map((bucket) => {
    const ordered = bucket.sort((a, b) => a.x - b.x);
    const merged = mergeAdjacent(ordered);
    return {
      y: ordered.reduce((s, it) => s + it.y, 0) / ordered.length,
      items: merged,
      text: merged.map((it) => it.text).join(" ").replace(/\s+/g, " ").trim(),
    };
  });
}

/** Joins runs that touch each other, so "PACK"+"ING" becomes one token. */
function mergeAdjacent(items: TextItem[]): TextItem[] {
  const out: TextItem[] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (prev) {
      const gap = item.x - (prev.x + prev.width);
      const sameLine = Math.abs(item.y - prev.y) < 1.2;
      if (sameLine && gap <= GLUE_GAP) {
        prev.text += item.text;
        prev.width = item.x + item.width - prev.x;
        continue;
      }
    }
    out.push({ ...item });
  }
  return out.filter((it) => it.text.trim().length > 0);
}

/** Center of a run — the anchor used when assigning runs to column bands. */
export const centerX = (item: TextItem): number => item.x + item.width / 2;

/** Normalizes a label for dictionary lookups: upper-case, unaccented, compact. */
export function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}
