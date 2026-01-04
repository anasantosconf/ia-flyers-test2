import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      tipo,        // GERAR_POST_INSTAGRAM | ATIVIDADE_GERAL | CONVERSA
      resposta,    // texto para o usuário
      prompt       // prompt estruturado (quando existir)
    } = body;

    /**
     * 🔹 1. GERAR FLYER
     */
    if (tipo === "GERAR_POST_INSTAGRAM") {
      return NextResponse.json({
        action: "GERAR_FLYER",
        message: resposta,
        data: {
          prompt,
          format: "instagram_feed",
          brand: "Confisegu"
        }
      });
    }

    /**
     * 🔹 2. ATIVIDADE / ANOTAÇÃO
     */
    if (tipo === "ATIVIDADE_GERAL") {
      // aqui depois você pode mandar direto pro Make
      return NextResponse.json({
        action: "CRIAR_TAREFA",
        message: resposta,
        data: {
          descricao: prompt
        }
      });
    }

    /**
     * 🔹 3. CONVERSA NORMAL
     */
    return NextResponse.json({
      action: "RESPONDER",
      message: resposta
    });

  } catch (error) {
    console.error("Erro no orchestrator:", error);
    return NextResponse.json(
      { error: "Erro ao processar a ação" },
      { status: 500 }
    );
  }
}