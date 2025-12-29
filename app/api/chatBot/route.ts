// app/api/chatBot/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = body.type;

    // Resposta padrão
    let replyText = "";

    if (eventType === "ADDED_TO_SPACE") {
      replyText = "Olá! Estou pronto para receber suas mensagens.";
    } else if (eventType === "MESSAGE") {
      const userText = body.message?.text || "";

      // Detecta se a mensagem é sobre flyer
      if (/flyer/i.test(userText)) {
        // Chama a API interna do gerador de flyer
        try {
          const flyerResponse = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/generateFlyerImage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: userText,
                brand: "confi-financas", // Exemplo, você pode mapear conforme o contexto
                type: "consorcio",
              }),
            }
          );
          const flyerData = await flyerResponse.json();

          if (flyerData.ok) {
            replyText = `Aqui está sua flyer: ${flyerData.imageUrl}`;
          } else {
            replyText = `Ocorreu um erro ao gerar a flyer: ${flyerData.error}`;
          }
        } catch (err: any) {
          replyText = `Erro ao chamar o gerador de flyer: ${err.message}`;
        }
      } else {
        // Mensagem genérica
        replyText = `Recebi sua mensagem: ${userText}`;
      }
    } else {
      replyText = `Evento não reconhecido: ${eventType}`;
    }

    // Retorna string limpa, Google Chat espera exatamente { text: string }
    return NextResponse.json({ text: replyText });
  } catch (err: any) {
    console.error("Erro no chatBot:", err);
    return NextResponse.json(
      { text: "Ocorreu um erro ao processar a mensagem." },
      { status: 500 }
    );
  }
}

// Bloqueia GET para evitar 405
export async function GET() {
  return NextResponse.json(
    { text: "Método GET não permitido neste endpoint." },
    { status: 405 }
  );
}