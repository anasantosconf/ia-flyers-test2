import sharp from "sharp";
import path from "path";

export async function overlayLogoOnBuffer({
  baseBuffer,
  logoPublicPath,
  position = "top-left",
  // SAFE AREA em px (mais consistente que %)
  marginPx = 56,
  // largura da logo em % da imagem
  logoWidthPct = 0.18,
  // se true, coloca um retângulo semi-transparente atrás da logo (ótimo em foto)
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

  const base = sharp(baseBuffer);
  const meta = await base.metadata();

  if (!meta.width || !meta.height) {
    return baseBuffer;
  }

  const targetLogoWidth = Math.round(meta.width * logoWidthPct);

  const logoBuffer = await sharp(logoFsPath)
    .resize({ width: targetLogoWidth, withoutEnlargement: true })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoBuffer).metadata();
  const lw = logoMeta.width || targetLogoWidth;
  const lh = logoMeta.height || Math.round(targetLogoWidth * 0.35);

  const left = position === "top-left"
    ? marginPx
    : meta.width - lw - marginPx;

  const top = marginPx;

  const composites: sharp.OverlayOptions[] = [];

  if (addBackdrop) {
    // fundo branco com transparência 70% e cantos arredondados (simulado)
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

  composites.push({
    input: logoBuffer,
    left,
    top,
  });

  return base.composite(composites).png().toBuffer();
}
