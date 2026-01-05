import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
const isDev = process.env.NODE_ENV !== "production";

function errJson(message: string, err?: any, status = 500) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(isDev && err
        ? {
            debug: {
              message: err?.message,
              details: err?.details,
              hint: err?.hint,
              code: err?.code,
              status: err?.status,
              stack: err?.stack,
            },
          }
        : {}),
    },
    { status }
  );
}

function getFlyerIdFromUrl(req: NextRequest): string | null {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const flyersIndex = parts.indexOf("flyers");
  if (flyersIndex === -1) return null;
  return parts[flyersIndex + 1] ?? null;
}

function buildChatText(flyer: any) {
  const title = flyer.title || `Flyer ${flyer.id}`;
  const drive = flyer.drive_url || "";
  const download = flyer.download_url || "";
  const image = flyer.image_url || "";

  return [
    `✅ *Flyer pronto para envio!*`,
    ``,
    `*${title}*`,
    ``,
    drive ? `📁 Drive: ${drive}` : null,
    download ? `⬇️ Download direto: ${download}` : null,
    image ? `🖼️ Imagem (Storage): ${image}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * POST /api/flyers/:id/send
 * body: { dry_run?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return errJson("Supabase admin NÃO configurado", null, 500);

    const flyerId = getFlyerIdFromUrl(req);
    if (!flyerId) return errJson("Não foi possível extrair flyerId da URL", null, 400);

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dry_run);

    const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
    if (!webhookUrl) return errJson("Missing GOOGLE_CHAT_WEBHOOK_URL no env", null, 500);

    // 1) Buscar flyer no Supabase
    const { data: flyer, error: fetchErr } = await supabaseAdmin
      .from("flyers")
      .select("*")
      .eq("id", flyerId)
      .maybeSingle();

    if (fetchErr) return errJson("Erro ao buscar flyer no Supabase", fetchErr, 500);
    if (!flyer) return errJson("Flyer não encontrado", null, 404);

    if (!flyer.drive_url) {
      return errJson(
        "Flyer ainda não foi entregue no Drive. Rode /deliver antes.",
        { flyer_id: flyerId, status: flyer.status, image_url: flyer.image_url },
        400
      );
    }

    const text = buildChatText(flyer);

    // 2) Dry run (não envia)
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        wouldSendToChat: true,
        flyer_id: flyerId,
        message: text,
      });
    }

    // 3) Enviar para Google Chat via webhook
    const chatRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ text }),
    });

    const raw = await chatRes.text();
    let chatJson: any = null;
    try {
      chatJson = JSON.parse(raw);
    } catch {
      // Google Chat às vezes pode retornar texto, mas normalmente é JSON
      chatJson = { raw };
    }

    if (!chatRes.ok) {
      return errJson("Google Chat webhook retornou erro", { status: chatRes.status, chatJson }, 502);
    }

    // 4) Atualizar status no Supabase (se colunas existirem, ele salva; se não, ignora via try)
    const updatePayload: any = {
      status: "SENT_CHAT",
    };

    // se você criou as colunas opcionais, elas serão preenchidas:
    updatePayload.sent_chat_at = new Date().toISOString();
    if (chatJson?.name) updatePayload.chat_message_id = chatJson.name;

    const { error: updateErr } = await supabaseAdmin
      .from("flyers")
      .update(updatePayload)
      .eq("id", flyerId);

    // Se não existir sent_chat_at/chat_message_id, o update pode falhar.
    // Não vamos quebrar o envio por causa disso.
    if (updateErr) {
      return NextResponse.json({
        success: true,
        warning: "Mensagem enviada, mas não consegui atualizar status no Supabase",
        flyer_id: flyerId,
        drive_url: flyer.drive_url,
        chat_response: chatJson,
        supabaseError: {
          message: updateErr.message,
          details: updateErr.details,
          hint: updateErr.hint,
          code: updateErr.code,
        },
      });
    }

    return NextResponse.json({
      success: true,
      flyer_id: flyerId,
      drive_url: flyer.drive_url,
      chat_response: chatJson,
    });
  } catch (err: any) {
    console.error("POST /send error:", err);
    return errJson("Erro inesperado no send", err, 500);
  }
}
