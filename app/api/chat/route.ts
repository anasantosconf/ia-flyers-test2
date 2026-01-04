import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    // ✅ Não quebra build local
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
Você é o assistente executivo pessoal da Ana, fundadora da Confisegu.
Seu papel NÃO é apenas conversar.
Seu papel é:
- Entender pedidos operacionais
- Classificar corretamente intenções
- Organizar trabalho
- Antecipar próximos passos
- Responder com clareza, objetividade e inteligência executiva

REGRAS:
1) Sempre responder em JSON puro. Nada fora do JSON.
2) Estrutura fixa:
{
  "tipo": "GERAR_POST_INSTAGRAM | ATIVIDADE_GERAL | CONVERSA",
  "resposta": "texto para o usuário",
  "prompt": "instrução operacional clara"
}
3) Se faltar informação, peça objetivamente.
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
    console.error("Erro no chat:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
