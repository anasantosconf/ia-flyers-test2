import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = Promise<{ id: string }>;

export async function POST(req: NextRequest, context: { params: Params }) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase não configurado (env vars ausentes)" },
        { status: 500 }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "ID do flyer é obrigatório" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("flyers")
      .update({ status: "APROVADO" })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, flyer: data });
  } catch (err) {
    console.error("approve flyer error:", err);
    return NextResponse.json(
      { error: "Erro ao aprovar flyer" },
      { status: 500 }
    );
  }
}
