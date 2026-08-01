/**
 * Locale-tolerant number parsing.
 *
 * Supplier documents mix conventions freely: "1.545,00" (es), "1,545.00" (en),
 * "855.75", "25,00". Getting this wrong silently corrupts weights by 1000x, so
 * we first sniff the document's dominant convention and then parse each token
 * against it, falling back to a per-token heuristic when the document is mute.
 */

export type NumberLocale = "es" | "en" | "unknown";

const ES_PATTERN = /\d{1,3}(?:\.\d{3})+,\d+/g;
const EN_PATTERN = /\d{1,3}(?:,\d{3})+\.\d+/g;
const ES_DECIMAL_ONLY = /(?:^|[^\d.,])\d+,\d{1,2}(?![\d.,])/g;
const EN_DECIMAL_ONLY = /(?:^|[^\d.,])\d+\.\d{1,2}(?![\d.,])/g;

function countMatches(text: string, re: RegExp): number {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

/** Sniffs whether a document writes numbers the Spanish or the English way. */
export function detectNumberLocale(text: string): NumberLocale {
  const esGrouped = countMatches(text, ES_PATTERN);
  const enGrouped = countMatches(text, EN_PATTERN);
  if (esGrouped > enGrouped * 2 && esGrouped >= 2) return "es";
  if (enGrouped > esGrouped * 2 && enGrouped >= 2) return "en";

  const esDecimals = countMatches(text, ES_DECIMAL_ONLY);
  const enDecimals = countMatches(text, EN_DECIMAL_ONLY);
  if (esDecimals > enDecimals * 2 && esDecimals >= 3) return "es";
  if (enDecimals > esDecimals * 2 && enDecimals >= 3) return "en";
  return "unknown";
}

const CLEAN = /[^0-9.,\-]/g;

/**
 * Parses a numeric token. Returns null when the token is not a number at all,
 * which lets callers tell "absent" from "zero".
 */
export function parseNumber(raw: string, locale: NumberLocale = "unknown"): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const negative = /^\(.*\)$/.test(trimmed) || trimmed.startsWith("-");
  const cleaned = trimmed.replace(CLEAN, "").replace(/-/g, "");
  if (!cleaned || !/\d/.test(cleaned)) return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // Both separators present: the rightmost one is the decimal mark.
    const decimalSep = lastDot > lastComma ? "." : ",";
    const groupSep = decimalSep === "." ? "," : ".";
    normalized = cleaned.split(groupSep).join("").replace(decimalSep, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    normalized = resolveSingleSeparator(cleaned, sep, locale);
  } else {
    normalized = cleaned;
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

function resolveSingleSeparator(cleaned: string, sep: string, locale: NumberLocale): string {
  const parts = cleaned.split(sep);
  const tail = parts[parts.length - 1];

  // Repeated separator can only be grouping: 1.234.567
  if (parts.length > 2) return parts.join("");

  const localeDecimal = locale === "es" ? "," : locale === "en" ? "." : null;
  if (localeDecimal) {
    return sep === localeDecimal ? parts.join(".") : parts.join("");
  }

  // No document-level hint: a 3-digit tail is grouping, anything else decimals.
  if (tail.length === 3 && parts[0].length > 0 && parts[0].length <= 3) return parts.join("");
  return parts.join(".");
}

/** Parses a token, returning 0 instead of null when it is not numeric. */
export function parseNumberOr0(raw: string, locale: NumberLocale = "unknown"): number {
  return parseNumber(raw, locale) ?? 0;
}

/** True when a token looks like a bare quantity rather than a code or a word. */
export function looksNumeric(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  return /^[(-]?\s*\d[\d.,\s]*\)?$/.test(t);
}

/**
 * Spanish presentation format: "." for thousands, "," for decimals.
 *
 * Written by hand rather than via `toLocaleString("es-ES")` because that helper
 * omits the separator on four-digit numbers ("1260,00"), while the NEXORA
 * document always groups them ("1.260,00").
 */
export function fmtNum(value: number, decimals = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  const negative = safe < 0;
  const fixed = Math.abs(safe).toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const body = fraction ? `${grouped},${fraction}` : grouped;
  return negative ? `-${body}` : body;
}

export const fmtInt = (value: number): string => fmtNum(value, 0);
