import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Params = Promise<{ id: string }>;

export async function POST(req: NextRequest, context: { params: Params }) {
  try {
    const { id } = await context.params;

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
    return NextResponse.json({ error: "Erro ao aprovar flyer" }, { status: 500 });
  }
}
