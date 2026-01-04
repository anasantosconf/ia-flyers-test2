// app/api/instagram/post/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    success: true,
    instagramPostId: "MOCK_IG_123",
    message: "Post publicado com sucesso (simulado)",
  });
}