import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const MAKE_WEBHOOK_URL =
  process.env.MAKE_DRIVE_WHATSAPP_WEBHOOK ||
  "https://hook.us2.make.com/esevum4fc3qyn7vn0b957f4mp3q2lya3";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase não configurado (env vars ausentes)" },
        { status: 500 }
      );
    }

    // Buscar flyer + mensagem vinculada (pra pegar o telefone)
    const { data: flyer, error: flyerError } = await supabaseAdmin
      .from("flyers")
      .select("*")
      .eq("id", id)
      .single();

    if (flyerError || !flyer) {
      return NextResponse.json({ error: "Flyer não encontrado" }, { status: 404 });
    }

    if (!flyer.preview_base64) {
      return NextResponse.json(
        { error: "Esse flyer ainda não tem imagem gerada" },
        { status: 400 }
      );
    }

    // Buscar inbox vinculada (telefone de quem pediu)
    const { data: inboxRow } = await supabaseAdmin
      .from("inbox_messages")
      .select("from_phone, from_id, from_name")
      .eq("linked_flyer_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const phone = inboxRow?.from_phone || inboxRow?.from_id;

    if (!phone) {
      return NextResponse.json(
        { error: "Não encontrei telefone para enviar (from_phone/from_id vazio)" },
        { status: 400 }
      );
    }

    // URL pública do PNG (via rota que serve o arquivo)
    const origin = req.nextUrl.origin;
    const imageUrl = `${origin}/api/flyers/${id}/image`;

    const fileName = `flyer-${(flyer.brand || "Confi").replace(/\s+/g, "-")}-${id}.png`;

    // ✅ payload que o Make vai receber
    const payload = {
      flyer_id: id,
      imageUrl,
      fileName,
      to_phone: phone,
      customer_name: inboxRow?.from_name || null,
      brand: flyer.brand || "Confi Seguros",
      format: flyer.format || "instagram_feed",
      messageText:
        "✅ Pronto! Seu material já está no Drive. Segue o link:",
    };

    const makeResp = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const makeJson = await makeResp.json().catch(() => null);

    if (!makeResp.ok) {
      console.error("Make webhook error:", makeJson);
      return NextResponse.json(
        { error: "Erro ao chamar Make", details: makeJson },
        { status: 500 }
      );
    }

    // Esperado do Make:
    // { ok: true, driveUrl: "...", whatsappSent: true, driveFileId: "...", driveFileName: "..." }

    const driveUrl = makeJson?.driveUrl || null;
    const whatsappSent = Boolean(makeJson?.whatsappSent);

    // Atualiza flyer
    const newStatus = whatsappSent ? "ENVIADO" : "APROVADO";

    const { error: updError } = await supabaseAdmin
      .from("flyers")
      .update({
        drive_url: driveUrl,
        status: newStatus,
      })
      .eq("id", id);

    if (updError) throw updError;

    return NextResponse.json({
      success: true,
      make: makeJson,
      updated: { id, status: newStatus, driveUrl },
    });
  } catch (err) {
    console.error("POST /api/flyers/[id]/send error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Erro interno" },
      { status: 500 }
    );
  }
}
