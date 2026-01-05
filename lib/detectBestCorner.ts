// lib/detectBestCorner.ts
import sharp from "sharp";

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type BgType = "light" | "dark";

function avg(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr: number[]) {
  const m = avg(arr);
  return avg(arr.map((x) => (x - m) ** 2));
}

// pega um recorte do canto
async function cropCorner(buffer: Buffer, corner: Corner, size: number) {
  const img = sharp(buffer).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error("No metadata");

  const w = meta.width;
  const h = meta.height;

  const left = corner.includes("right") ? w - size : 0;
  const top = corner.includes("bottom") ? h - size : 0;

  return img.extract({ left, top, width: size, height: size }).raw().toBuffer({ resolveWithObject: true });
}

export async function detectBestCorner({
  baseBuffer,
  patchSize = 220,
}: {
  baseBuffer: Buffer;
  patchSize?: number;
}): Promise<{
  corner: Corner;
  background: BgType;
  debug: Record<string, any>;
}> {
  const corners: Corner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

  const scores: Record<string, any> = {};

  for (const c of corners) {
    const { data, info } = await cropCorner(baseBuffer, c, patchSize);

    // data = RGB or RGBA
    const channels = info.channels;

    const luminances: number[] = [];
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // luminância perceptiva
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      luminances.push(y);
    }

    const v = variance(luminances); // quanto mais alto, mais “ocupado”
    const m = avg(luminances);      // define se é claro ou escuro

    // score: queremos canto mais LIMPO, então menor variância vence
    scores[c] = {
      variance: v,
      meanLuma: m,
      background: m > 145 ? "light" : "dark",
      score: v,
    };
  }

  // pega o canto com menor score
  const best = corners.reduce((acc, c) => (scores[c].score < scores[acc].score ? c : acc), corners[0]);

  return {
    corner: best,
    background: scores[best].background,
    debug: scores,
  };
}
