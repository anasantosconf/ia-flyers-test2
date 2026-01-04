// lib/generateFlyer.ts
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateFlyer(prompt: string, brand: string, type: string) {
  if (!prompt) throw new Error("Prompt não informado");

  const finalPrompt = `
Crie um flyer profissional.
Marca: ${brand || "Confisegu"}
Tipo: ${type || "flyer"}
Descrição: ${prompt}
Estilo moderno, corporativo, alta qualidade.
`;

  const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt: finalPrompt,
    size: "1024x1024",
  });

  if (!result.data || result.data.length === 0 || !result.data[0].b64_json) {
    throw new Error("Imagem não retornada pela OpenAI");
  }

  const imageBuffer = Buffer.from(result.data[0].b64_json, "base64");
  const fileName = `${(type || "flyer").replace(/\s+/g, "_")}.png`;
  const filePath = path.join(process.cwd(), "tmp", fileName);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, imageBuffer);

  return { filePath, fileName };
}