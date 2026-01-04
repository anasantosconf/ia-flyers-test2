import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json([], { status: 200 });
    }

    const { data, error } = await supabaseAdmin
      .from("inbox_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/inbox error:", err);
    return NextResponse.json({ error: "Erro ao buscar inbox" }, { status: 500 });
  }
}
