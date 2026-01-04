import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type ImageSize =
  | "1024x1024"
  | "1024x1792"
  | "auto"
  | "1536x1024"
  | "1024x1536"
  | "256x256"
  | "512x512"
  | "1792x1024";

export async function POST(req: NextRequest) {
  try {
    const { prompt, brand, format } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt é obrigatório" }, { status: 400 });
    }

    const sizeMap: Record<string, ImageSize> = {
      instagram_feed: "1024x1024",
      instagram_story: "1024x1792",
      whatsapp: "1024x1024",
    };

    const imageSize: ImageSize = sizeMap[format] || "1024x1024";

    const finalPrompt = `
Crie um flyer profissional para redes sociais.

Marca: ${brand || "Confi Seguros"}
Objetivo: ${format || "instagram_feed"}

IDENTIDADE VISUAL (obrigatório):
- Cores principais: amarelo #ffce0a, preto #000000, branco #ffffff (ou equivalente conforme marca)
- Tipografia: Causten (principal), Caladea Itálico (apenas detalhes)
- Estilo: corporativo, moderno, premium, clean
- Texto SEM erros de português e SEM erros de acentuação
- Não use letras exageradamente grandes: boa hierarquia e leitura fácil
- Layout com contraste forte e alinhamento profissional

ELEMENTO MARCA (obrigatório):
- Uma linha curva/amarela atravessando ou contornando o elemento principal (pessoa/carro/imóvel),
  representando proteção e movimento, estilo moderno e fluido.

Conteúdo:
${prompt}

Regras:
- alta qualidade, aparência de anúncio real
- sem erros ortográficos
- texto curto e impactante
- ícones e CTA bem posicionados
    `.trim();

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: finalPrompt,
      size: imageSize,
    });

    const imageBase64 = result.data?.[0]?.b64_json;
    if (!imageBase64) throw new Error("Imagem não gerada");

    return NextResponse.json({
      success: true,
      previewBase64: imageBase64,
    });
  } catch (error) {
    console.error("generateFlyer error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Erro interno" },
      { status: 500 }
    );
  }
}
