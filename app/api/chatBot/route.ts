// app/api/chatBot/route.ts
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Google Chat envia JSON
    await req.json();

    return new Response(
      JSON.stringify({
        text: "Ok, já recebi seu pedido 👍\nEm breve te retorno.",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        text: "Erro ao processar sua mensagem.",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}