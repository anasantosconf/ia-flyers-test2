import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const flyerId = params.id;

    if (!flyerId) {
      return NextResponse.json({ error: "ID do flyer é obrigatório" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("flyers")
      .update({ status: "APROVADO" })
      .eq("id", flyerId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, flyer: data });
  } catch (err) {
    console.error("approve flyer error:", err);
    return NextResponse.json({ error: "Erro ao aprovar flyer" }, { status: 500 });
  }
}
