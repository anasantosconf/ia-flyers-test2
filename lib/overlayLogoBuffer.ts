import sharp from "sharp";
import path from "path";

export async function overlayLogoOnBuffer({
  baseBuffer,
  logoPublicPath,
  position = "top-right",
  marginPct = 0.05,
  logoWidthPct = 0.22,
}: {
  baseBuffer: Buffer;
  logoPublicPath: string; // ex: /logos/seguros/logo_seguros_branco_e_amarelo_lado.png
  position?: "top-left" | "top-right";
  marginPct?: number;
  logoWidthPct?: number;
}): Promise<Buffer> {
  const logoFsPath = path.join(process.cwd(), "public", logoPublicPath);

  const base = sharp(baseBuffer);
  const meta = await base.metadata();

  if (!meta.width || !meta.height) {
    // fallback: retorna original se não conseguir metadados
    return baseBuffer;
  }

  const margin = Math.round(meta.width * marginPct);
  const targetLogoWidth = Math.round(meta.width * logoWidthPct);

  const logoBuffer = await sharp(logoFsPath)
    .resize({ width: targetLogoWidth, withoutEnlargement: true })
    .png()
    .toBuffer();

  const logoMeta = await sharp(logoBuffer).metadata();

  const left =
    position === "top-left"
      ? margin
      : meta.width - (logoMeta.width || targetLogoWidth) - margin;

  const top = margin;

  return base
    .composite([{ input: logoBuffer, left, top }])
    .png()
    .toBuffer();
}
