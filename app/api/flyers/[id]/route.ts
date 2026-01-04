import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Params = Promise<{ id: string }>;

export async function GET(req: NextRequest, context: { params: Params }) {
  try {
    const { id } = await context.params;

    const { data, error } = await supabaseAdmin
      .from("flyers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, flyer: data });
  } catch (err) {
    console.error("GET /api/flyers/[id] error:", err);
    return NextResponse.json({ error: "Erro ao buscar flyer" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Params }) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const { data, error } = await supabaseAdmin
      .from("flyers")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, flyer: data });
  } catch (err) {
    console.error("PATCH /api/flyers/[id] error:", err);
    return NextResponse.json({ error: "Erro ao atualizar flyer" }, { status: 500 });
  }
}
