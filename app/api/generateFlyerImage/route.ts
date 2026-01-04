import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

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
    const apiKey = process.env.OPENAI_API_KEY;

    // ✅ Não pode quebrar build
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY não configurada" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const { prompt, brand, format } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt é obrigatório" }, { status: 400 });
    }

    // 🔹 Mapear formatos para tipos válidos do SDK
    const sizeMap: Record<string, ImageSize> = {
      instagram_feed: "1024x1024",
      instagram_story: "1024x1792",
      whatsapp: "1024x1024",
    };
    const imageSize: ImageSize = sizeMap[format] || "1024x1024";

    // 🔹 Prompt final — alinhado com sua identidade visual (Confi)
    const finalPrompt = `
Crie um flyer profissional para redes sociais, com aparência de anúncio real.

MARCA: ${brand || "Confi Seguros"}
FORMATO: ${format || "instagram_feed"}

IDENTIDADE VISUAL (obrigatório):
- Paleta de cores deve seguir a marca:
  • Confi Seguros: #ffce0a, #ffffff, #000000
  • Confi Benefícios: #f5886c, #ffffff, #000000
  • Confi Finanças: #1260c7, #ffffff, #000000
- Tipografia: Causten (principal). Caladea Itálico apenas em detalhes.
- Estilo: corporativo, moderno, clean, premium.
- Hierarquia visual clara: textos importantes em destaque, porém SEM letras exageradamente grandes.
- Layout limpo e equilibrado, com contraste forte e alinhamento profissional.

REGRAS DE TEXTO (obrigatório):
- NÃO pode ter erros de português.
- NÃO pode ter erros de acentuação.
- Não inventar dados/confissões absurdas.

ELEMENTO GRÁFICO DA MARCA (obrigatório):
- Uma linha curva fluida na cor principal da marca (amarelo/coral/azul)
  deve atravessar ou contornar o elemento principal (pessoa/carro/casa/moto),
  simbolizando proteção, movimento e assinatura visual.

CONTEÚDO DO FLYER:
${prompt}

EXIGÊNCIAS:
- Alta qualidade visual
- Sem erros ortográficos
- Tipografia legível e bem distribuída
- CTA e contatos em área inferior organizada
    `.trim();

    // 🔹 Gerar imagem
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
    console.error("generateFlyerImage error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Erro interno no servidor" },
      { status: 500 }
    );
  }
}
