import { NextRequest, NextResponse } from "next/server";

// Simulação de resposta do assistente localmente
export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ ok: false, error: "Prompt obrigatório" }, { status: 400 });
    }

    // Aqui você cria a resposta simulando o assistente
    const textoFlyer = `
Texto gerado pelo assistente para: "${prompt}"

Sugestão de flyer:

1️⃣ Título: "${prompt.toUpperCase()}"
2️⃣ Subtítulo: Aproveite as melhores condições
3️⃣ Benefícios:
- Parcelas acessíveis
- Sem entrada
- Condições especiais
4️⃣ Elemento visual: [Imagem de carro, imóvel ou casa dependendo do contexto]
5️⃣ Rodapé: Confi Financeira | PortoBank | Observações legais
`;

    // Retorno simulado (sem imagem ainda)
    return NextResponse.json({ ok: true, text: textoFlyer });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}