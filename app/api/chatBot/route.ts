import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    return NextResponse.json({
      text: `Recebi sua mensagem: ${body.message ?? "sem texto"}`
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro no bot" },
      { status: 500 }
    );
  }
}