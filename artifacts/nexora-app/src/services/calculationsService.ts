export const AREA_PER_PIECE = 5.12;
export const NET_KG_PER_PIECE = 153.6;
export const MAX_PIECES_PER_AFRAME = 22;
export const AFRAME_TARE_KG = 240;
export const AFRAME_LENGTH_M = 3.3;
export const AFRAME_WIDTH_M = 0.75;
export const AFRAME_HEIGHT_M = 2.0;

export const EUROPAL_LENGTH_M = 1.2;
export const EUROPAL_WIDTH_M = 0.8;

export function calcPieces(m2: number): number {
  return Math.round(m2 / AREA_PER_PIECE);
}

export function calcNetWeight(pieces: number): number {
  return pieces * NET_KG_PER_PIECE;
}

export function calcAFrames(pieces: number): number {
  return Math.ceil(pieces / MAX_PIECES_PER_AFRAME);
}

export function calcGrossWeight(netKg: number, frames: number): number {
  return netKg + frames * AFRAME_TARE_KG;
}

export function calcCBM(frames: number): number {
  return frames * (AFRAME_LENGTH_M * AFRAME_WIDTH_M * AFRAME_HEIGHT_M);
}

export function calcEuropalCBM(qty: number, height: number): number {
  return qty * (EUROPAL_LENGTH_M * EUROPAL_WIDTH_M * height);
}

export function isLargeFormatTile(description: string): boolean {
  const lowerDesc = description.toLowerCase();
  const hasDimensions =
    /324\s*[xX×]\s*162/.test(description) ||
    /320\s*[xX×]\s*160/.test(description);
  const hasThickness = lowerDesc.includes("12+") || lowerDesc.includes("12mm");
  return hasDimensions || hasThickness;
}
