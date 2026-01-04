import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Mensagem não fornecida" },
        { status: 400 }
      );
    }

    const systemPrompt = `
Você é o estrategista de marketing da Confisegu.

Seu papel é:
- Pensar estratégias de marketing e vendas
- Criar ideias de campanhas
- Sugerir conteúdos para Instagram, WhatsApp e funil
- Traduzir objetivos comerciais em ações práticas
- Atuar como um head de marketing experiente

REGRAS:
- Responda SEMPRE em JSON puro
- Nunca use markdown
- Nunca explique o processo
- Seja prático, estratégico e aplicável

Estrutura obrigatória:
{
  "tipo": "IDEIA_MARKETING | PLANO_MARKETING | CONTEUDO_MARKETING | ANALISE_MARKETING",
  "resposta": "resumo executivo direto",
  "ideias": ["ideia 1", "ideia 2", "ideia 3"],
  "observacoes": "insights estratégicos adicionais"
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    const content = completion.choices[0].message.content;

    if (!content) {
      throw new Error("Resposta vazia da OpenAI");
    }

    // Garante que sempre retorna JSON válido
    const parsed = JSON.parse(content);

    return NextResponse.json(parsed);

  } catch (error) {
    console.error("Erro chat-marketing:", error);

    return NextResponse.json(
      {
        tipo: "ERRO",
        resposta: "Erro ao gerar resposta de marketing.",
        ideias: [],
        observacoes: ""
      },
      { status: 500 }
    );
  }
}