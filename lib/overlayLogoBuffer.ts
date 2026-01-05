import sharp from "sharp";
import path from "path";

export async function overlayLogoOnBuffer({
  baseBuffer,
  logoPublicPath,
  position = "top-left",
  marginPx = 56,
  logoWidthPct = 0.18,
  addBackdrop = false,
  debugDraw = false,
}: {
  baseBuffer: Buffer;
  logoPublicPath: string;
  position?: "top-left" | "top-right";
  marginPx?: number;
  logoWidthPct?: number;
  addBackdrop?: boolean;
  debugDraw?: boolean;
}): Promise<{
  buffer: Buffer;
  debug: {
    logoWidth: number;
    logoHeight: number;
    usedTrim: boolean;
    position: string;
    left: number;
    top: number;
    baseWidth: number;
    baseHeight: number;
  };
}> {
  const logoFsPath = path.join(process.cwd(), "public", logoPublicPath);

  const base = sharp(baseBuffer).rotate();
  const meta = await base.metadata();

  if (!meta.width || !meta.height) {
    return {
      buffer: baseBuffer,
      debug: {
        logoWidth: 0,
        logoHeight: 0,
        usedTrim: false,
        position,
        left: 0,
        top: 0,
        baseWidth: 0,
        baseHeight: 0,
      },
    };
  }

  const baseWidth = meta.width;
  const baseHeight = meta.height;
  const targetLogoWidth = Math.round(baseWidth * logoWidthPct);

  // Resize seguro
  const resizedLogoBuffer = await sharp(logoFsPath)
    .rotate()
    .resize({ width: targetLogoWidth, withoutEnlargement: true })
    .png()
    .toBuffer();

  // Trim seguro
  let logoBuffer = resizedLogoBuffer;
  let usedTrim = false;
  try {
    const trimmed = await sharp(resizedLogoBuffer).trim({ threshold: 5 }).png().toBuffer();
    const tMeta = await sharp(trimmed).metadata();
    if ((tMeta.width || 0) >= 40 && (tMeta.height || 0) >= 20) {
      logoBuffer = trimmed;
      usedTrim = true;
    }
  } catch {}

  const logoMeta = await sharp(logoBuffer).metadata();
  const lw = logoMeta.width || targetLogoWidth;
  const lh = logoMeta.height || Math.round(targetLogoWidth * 0.35);

  const left =
    position === "top-left"
      ? marginPx
      : baseWidth - lw - marginPx;

  const top = marginPx;

  const composites: sharp.OverlayOptions[] = [];

  // ✅ DEBUG: marca o canto (0,0) e desenha o box da logo
  if (debugDraw) {
    const marker = `
      <svg width="${baseWidth}" height="${baseHeight}">
        <!-- marker no canto (0,0) -->
        <rect x="0" y="0" width="40" height="40" fill="red" fill-opacity="0.85" />
        <!-- box onde a logo deveria estar -->
        <rect x="${left}" y="${top}" width="${lw}" height="${lh}" stroke="red" stroke-width="6" fill="none" />
      </svg>
    `;
    composites.push({ input: Buffer.from(marker), left: 0, top: 0 });
  }

  if (addBackdrop) {
    const pad = 14;
    const bw = lw + pad * 2;
    const bh = lh + pad * 2;
    const backdropSvg = `
      <svg width="${bw}" height="${bh}">
        <rect x="0" y="0" width="${bw}" height="${bh}" rx="16" ry="16" fill="white" fill-opacity="0.72" />
      </svg>
    `;
    composites.push({ input: Buffer.from(backdropSvg), left: left - pad, top: top - pad });
  }

  composites.push({ input: logoBuffer, left, top });

  const out = await base.composite(composites).png().toBuffer();

  return {
    buffer: out,
    debug: {
      logoWidth: lw,
      logoHeight: lh,
      usedTrim,
      position,
      left,
      top,
      baseWidth,
      baseHeight,
    },
  };
}
