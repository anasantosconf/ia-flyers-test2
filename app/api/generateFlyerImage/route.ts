// app/api/generateFlyerImage/route.ts

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/** =========================
 * OpenAI Client
 * ========================= */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/** =========================
 * Types
 * ========================= */
type ImageSize =
  | "1024x1024"
  | "1024x1792"
  | "auto"
  | "1536x1024"
  | "1024x1536"
  | "256x256"
  | "512x512"
  | "1792x1024";

type FlyerFormat = "instagram_feed" | "instagram_story" | "whatsapp";

type BrandName = "Confi Seguros" | "Confi Benefícios" | "Confi Finanças";

/** =========================
 * Brand Identity Map
 * ========================= */
const BRAND_IDENTITY: Record<
  BrandName,
  {
    brand: BrandName;
    primary: string;
    black: string;
    white: string;
    vibe: string;
    notes: string;
  }
> = {
  "Confi Seguros": {
    brand: "Confi Seguros",
    primary: "#ffce0a",
    black: "#000000",
    white: "#ffffff",
    vibe: "institucional, confiança, proteção, premium, corporativo",
    notes: "Seguro, proteção, tranquilidade, patrimônio, cuidado, credibilidade",
  },
  "Confi Benefícios": {
    brand: "Confi Benefícios",
    primary: "#f5886c",
    black: "#000000",
    white: "#ffffff",
    vibe: "humanizado, acolhedor, saúde, bem-estar, moderno e leve",
    notes: "Família, cuidado, sorriso, bem-estar, vida saudável",
  },
  "Confi Finanças": {
    brand: "Confi Finanças",
    primary: "#1260c7",
    black: "#000000",
    white: "#ffffff",
    vibe: "financeiro, forte, corporativo, anúncio de crédito, comercial",
    notes: "Crédito, consórcio, parcelas, condições, clareza financeira, impacto",
  },
};

/** =========================
 * Helpers
 * ========================= */
function normalizeBrand(input?: string): BrandName {
  if (!input) return "Confi Seguros";
  const lower = input.toLowerCase();

  if (lower.includes("benef")) return "Confi Benefícios";
  if (lower.includes("finan")) return "Confi Finanças";
  if (lower.includes("segu")) return "Confi Seguros";

  return "Confi Seguros";
}

function normalizeFormat(input?: string): FlyerFormat {
  if (!input) return "instagram_feed";
  const lower = input.toLowerCase();

  if (lower.includes("story")) return "instagram_story";
  if (lower.includes("whats")) return "whatsapp";

  return "instagram_feed";
}

function mapFormatToImageSize(format: FlyerFormat): ImageSize {
  const sizeMap: Record<FlyerFormat, ImageSize> = {
    instagram_feed: "1024x1024",
    instagram_story: "1024x1792",
    whatsapp: "1024x1024",
  };
  return sizeMap[format] ?? "1024x1024";
}

/** =========================
 * Master Prompt Builder
 * ========================= */
function buildMasterPrompt(params: {
  prompt: string;
  brand: BrandName;
  format: FlyerFormat;
}) {
  const identity = BRAND_IDENTITY[params.brand];

  const masterPrompt = `
Crie um flyer profissional para Instagram com aparência de ANÚNCIO REAL (moderno, corporativo e limpo), seguindo RIGOROSAMENTE a identidade visual.

IDENTIDADE VISUAL (obrigatório):
- Marca: ${identity.brand}
- Paleta de cores: ${identity.primary} (principal) + ${identity.black} + ${identity.white}
- Tipografia: Fonte principal Causten (moderna, clean, corporativa). Fonte de detalhe Caladea Itálico (usar apenas em 1 frase curta ou destaque).
- Estilo: ${identity.vibe}

REGRAS CRÍTICAS (sem exceção):
1) Texto em Português do Brasil com ortografia e acentuação PERFEITAS. Nunca erre português.
2) NÃO usar letras muito grandes (evitar títulos gigantes). Tipos equilibrados e legíveis.
3) Poucas frases, curtas e diretas. Evitar excesso de texto.
4) Hierarquia visual clara: Título > Subtítulo > Boxes de vantagem > CTA > Rodapé legal.
5) Visual limpo, organizado, com espaço em branco e safe margins (texto longe das bordas).
6) O flyer deve parecer um anúncio institucional real e profissional.

ASSINATURA VISUAL CONFI (obrigatório e central):
- Inserir uma linha curva orgânica/fluida na cor principal (${identity.primary}).
- Essa linha deve ATRAVESSAR e “cortar” o elemento principal (pessoa/carro/casa/moto), passando na frente e integrando com o layout.
- A linha deve criar movimento e simbolizar proteção/cobertura.
- A linha NÃO pode ficar só no canto: precisa cruzar o objeto principal e ser elemento central.

COMPOSIÇÃO OBRIGATÓRIA:
- Fundo: alto contraste, moderno e corporativo; pode ser fundo escuro com gradiente ou imagem desfocada com vinheta leve para destacar textos.
- Elemento visual principal: imagem fotográfica e realista relacionada ao tema (pessoa/família relaxando, casa moderna, carro, moto, imóvel, cenário de risco/prevenção, etc).
- Conteúdo: título do produto + 1 subtítulo curto + 2 a 4 boxes de vantagens com números (se aplicável) + CTA em botão + rodapé com contatos e texto legal pequeno.
- Rodapé: incluir logotipo da marca, WhatsApp/telefone/Instagram com ícones minimalistas (na cor principal), e texto legal menor (legível, sem poluir).
- Não inventar marcas de terceiros se não forem citadas.

CONTROLE DE TEXTO:
- Evitar blocos longos.
- Título curto.
- Total de texto (exceto rodapé legal) deve ser moderado e fácil de ler.
- Nada de texto estourando ou cortado.

FORMATO:
- ${params.format} (respeitar proporção e composição adequada para ${params.format}).

CONTEÚDO A SER TRANSFORMADO EM FLYER:
${params.prompt}

Entregue a arte com forte contraste, estética premium e aparência de anúncio real.
`.trim();

  return masterPrompt;
}

/** =========================
 * Route Handler
 * ========================= */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPrompt = String(body?.prompt ?? "").trim();
    const brand = normalizeBrand(body?.brand);
    const format = normalizeFormat(body?.format);

    if (!rawPrompt) {
      return NextResponse.json({ error: "Prompt é obrigatório" }, { status: 400 });
    }

    const imageSize = mapFormatToImageSize(format);
    const finalPrompt = buildMasterPrompt({
      prompt: rawPrompt,
      brand,
      format,
    });

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: finalPrompt,
      size: imageSize,
    });

    const imageBase64 = result.data?.[0]?.b64_json;
    if (!imageBase64) {
      return NextResponse.json({ error: "Imagem não gerada" }, { status: 500 });
    }

    const fileName = `flyer_${brand.replace(/\s/g, "_").toLowerCase()}_${Date.now()}.png`;

    return NextResponse.json({
      success: true,
      brand,
      format,
      fileName,
      previewBase64: imageBase64,
    });
  } catch (error) {
    console.error("generateFlyerImage error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Erro interno ao gerar a imagem" },
      { status: 500 }
    );
  }
}
