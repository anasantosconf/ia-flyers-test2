import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

/**
 * Cola a logo (PNG) no topo direito ou esquerdo do flyer.
 * - inputPath: imagem base
 * - outputPath: imagem final com logo
 * - logoPublicPath: "/logos/seguros/logo.png"
 */
export async function overlayLogoOnImage({
  inputPath,
  outputPath,
  logoPublicPath,
  position = "top-right",
  marginPct = 0.05,     // 5% de margem
  logoWidthPct = 0.22,  // logo ocupa ~22% da largura do flyer
}: {
  inputPath: string;
  outputPath: string;
  logoPublicPath: string;
  position?: "top-left" | "top-right";
  marginPct?: number;
  logoWidthPct?: number;
}) {
  const logoFsPath = path.join(process.cwd(), "public", logoPublicPath);

  const base = sharp(inputPath);
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("Invalid base image metadata");

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

  const composed = await base
    .composite([{ input: logoBuffer, left, top }])
    .png()
    .toBuffer();

  await fs.writeFile(outputPath, composed);
}
