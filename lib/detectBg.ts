import sharp from "sharp";

export async function detectCornerBg({
  baseBuffer,
  corner = "top-left",
}: {
  baseBuffer: Buffer;
  corner?: "top-left" | "top-right";
}): Promise<"light" | "dark"> {
  const img = sharp(baseBuffer);
  const meta = await img.metadata();
  if (!meta.width || !meta.height) return "dark";

  const w = Math.max(1, Math.floor(meta.width * 0.20));
  const h = Math.max(1, Math.floor(meta.height * 0.20));

  const left = corner === "top-left" ? 0 : meta.width - w;
  const top = 0;

  const { data } = await img
    .extract({ left, top, width: w, height: h })
    .resize(20, 20)
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const avg = sum / (data.length / 3);
  return avg < 140 ? "dark" : "light";
}
