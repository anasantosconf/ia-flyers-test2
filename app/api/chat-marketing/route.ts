import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY não configurada" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    const systemPrompt = `
Você é um assistente de marketing da marca Confi.
Você cria e organiza pedidos de flyers e conteúdos.
Sempre responda em JSON puro:
{
  "tipo": "GERAR_POST_INSTAGRAM | ATIVIDADE_GERAL | CONVERSA",
  "resposta": "texto para o usuário",
  "prompt": "prompt final pronto para gerar a arte"
}
Regras:
- Nunca ter erros de português ou acentuação.
- Sempre respeitar identidade visual Confi (cores, tipografia, estilo clean).
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    const resposta = completion.choices[0].message.content;

    return NextResponse.json({ ai: resposta });
  } catch (error) {
    console.error("Erro no chat-marketing:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
