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
}): Promise<Buffer> {
  const logoFsPath = path.join(process.cwd(), "public", logoPublicPath);

  // ✅ Base (normaliza orientação também)
  const base = sharp(baseBuffer).rotate();
  const meta = await base.metadata();

  if (!meta.width || !meta.height) return baseBuffer;

  const targetLogoWidth = Math.round(meta.width * logoWidthPct);

  /**
   * ✅ LOGO:
   * - rotate() pra normalizar
   * - trim() pra remover padding transparente
   * - resize() depois do trim
   */
  const trimmedLogo = sharp(logoFsPath)
    .rotate()
    .trim();

  const logoBuffer = await trimmedLogo
    .resize({ width: targetLogoWidth, withoutEnlargement: true })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoBuffer).metadata();

  const lw = logoMeta.width || targetLogoWidth;
  const lh = logoMeta.height || Math.round(targetLogoWidth * 0.35);

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

  // ✅ Render final (mantém em PNG)
  return base.composite(composites).png().toBuffer();
}

