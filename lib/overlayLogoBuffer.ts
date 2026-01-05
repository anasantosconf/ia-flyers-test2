import sharp from "sharp";
import path from "path";

export async function overlayLogoOnBuffer({
  baseBuffer,
  logoPublicPath,
  position = "top-left",
  marginPx = 56,
  logoWidthPct = 0.18,
  addBackdrop = false,
}: {
  baseBuffer: Buffer;
  logoPublicPath: string;
  position?: "top-left" | "top-right";
  marginPx?: number;
  logoWidthPct?: number;
  addBackdrop?: boolean;
}): Promise<{
  buffer: Buffer;
  debug: {
    logoWidth: number;
    logoHeight: number;
    usedTrim: boolean;
    position: string;
    left: number;
    top: number;
  };
}> {
  const logoFsPath = path.join(process.cwd(), "public", logoPublicPath);

  // ✅ Base normalizada
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
      },
    };
  }

  const targetLogoWidth = Math.round(meta.width * logoWidthPct);

  // 1) primeiro resize SEM trim (seguro)
  const resizedLogoBuffer = await sharp(logoFsPath)
    .rotate()
    .resize({ width: targetLogoWidth, withoutEnlargement: true })
    .png()
    .toBuffer();

  // 2) tenta trim com segurança
  let logoBuffer = resizedLogoBuffer;
  let usedTrim = false;

  try {
    const trimmed = await sharp(resizedLogoBuffer)
      .trim({ threshold: 5 }) // threshold baixo pra não “comer” a logo
      .png()
      .toBuffer();

    const tMeta = await sharp(trimmed).metadata();

    // ✅ se o trim der resultado MUITO pequeno, ignora
    if ((tMeta.width || 0) >= 40 && (tMeta.height || 0) >= 20) {
      logoBuffer = trimmed;
      usedTrim = true;
    }
  } catch {
    // ignora trim se falhar
  }

  const logoMeta = await sharp(logoBuffer).metadata();
  const lw = logoMeta.width || targetLogoWidth;
  const lh = logoMeta.height || Math.round(targetLogoWidth * 0.35);

  // ✅ posição
  const left =
    position === "top-left"
      ? marginPx
      : meta.width - lw - marginPx;

  const top = marginPx;

  const composites: sharp.OverlayOptions[] = [];

  if (addBackdrop) {
    const pad = 14;
    const bw = lw + pad * 2;
    const bh = lh + pad * 2;

    const backdropSvg = `
      <svg width="${bw}" height="${bh}">
        <rect x="0" y="0" width="${bw}" height="${bh}" rx="16" ry="16" fill="white" fill-opacity="0.72" />
      </svg>
    `;

    composites.push({
      input: Buffer.from(backdropSvg),
      left: left - pad,
      top: top - pad,
    });
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
    },
  };
}
