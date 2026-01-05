import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import crypto from "crypto";

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

/**
 * Extrai o flyerId diretamente do URL:
 * /api/flyers/:id/deliver
 */
function getFlyerIdFromUrl(req: NextRequest): string | null {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  // ["api","flyers",":id","deliver"]
  const flyersIndex = parts.indexOf("flyers");
  if (flyersIndex === -1) return null;
  return parts[flyersIndex + 1] ?? null;
}

/**
 * POST /api/flyers/:id/deliver
 * body: { dry_run?: boolean, force?: boolean }
 *
 * Idempotente:
 * - se drive_url já existe e force = false -> retorna sem chamar Make
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return errJson("Supabase admin NÃO configurado", null, 500);

    const flyerId = getFlyerIdFromUrl(req);
    if (!flyerId) return errJson("Não foi possível extrair flyerId da URL", null, 400);

    const body = await req.json().catch(() => ({}));
    const dryRun = Boolean(body?.dry_run);
    const force = Boolean(body?.force);

    const makeUrl = process.env.MAKE_WEBHOOK_URL;
    if (!makeUrl) return errJson("Missing MAKE_WEBHOOK_URL no env", null, 500);

    // 1) Buscar flyer
    const { data: flyer, error: fetchErr } = await supabaseAdmin
      .from("flyers")
      .select("*")
      .eq("id", flyerId)
      .maybeSingle();

    if (fetchErr) return errJson("Erro ao buscar flyer no Supabase", fetchErr, 500);
    if (!flyer) return errJson("Flyer não encontrado", null, 404);

    if (!flyer.image_url) {
      return errJson("Flyer sem image_url. Rode /upload-image antes.", null, 400);
    }

    // 2) Se já entregue, retorna e NÃO chama Make
    if (flyer.drive_url && !force) {
      return NextResponse.json({
        success: true,
        alreadyDelivered: true,
        flyer_id: flyerId,
        drive_url: flyer.drive_url,
        download_url: flyer.download_url ?? null,
        image_url: flyer.image_url,
        status: flyer.status ?? null,
      });
    }

    // 3) Dry run (não chama Make)
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        wouldCallMake: true,
        flyer_id: flyerId,
        image_url: flyer.image_url,
        make_webhook: makeUrl,
      });
    }

    // 4) Chamar Make
    const requestId = crypto.randomUUID();

    const payload = {
      request_id: requestId,
      flyer_id: flyerId,
      title: flyer.title ?? `Flyer ${flyerId}`,
      image_url: flyer.image_url,
      drive: {
        filename: `flyer-${flyerId}.png`,
      },
    };

    const makeRes = await fetch(makeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = await makeRes.text();

    let makeJson: any = null;
    try {
      makeJson = JSON.parse(raw);
    } catch {
      return errJson(
        "Make não retornou JSON (adicione Webhooks → Response no final do cenário).",
        { raw: raw.slice(0, 800), status: makeRes.status },
        502
      );
    }

    if (!makeRes.ok) return errJson("Make retornou erro", makeJson, 502);

    const driveUrl = makeJson?.drive_url || makeJson?.share_link;
    const downloadUrl = makeJson?.download_url || makeJson?.web_content_link;

    if (!driveUrl) return errJson("Make não retornou drive_url", makeJson, 502);

    // 5) Salvar no Supabase
    const { data: updatedRows, error: updateErr } = await supabaseAdmin
      .from("flyers")
      .update({
        drive_url: driveUrl,
        download_url: downloadUrl ?? null,
        status: "DELIVERED",
      })
      .eq("id", flyerId)
      .select("*");

    if (updateErr) {
      // Drive foi ok mas falhou salvar Supabase
      return NextResponse.json({
        success: true,
        warning: "Drive uploaded mas Supabase update falhou",
        flyer_id: flyerId,
        drive_url: driveUrl,
        download_url: downloadUrl ?? null,
        make_response: makeJson,
        supabaseError: {
          message: updateErr.message,
          details: updateErr.details,
          hint: updateErr.hint,
          code: updateErr.code,
        },
      });
    }

    const updated = updatedRows?.[0];

    return NextResponse.json({
      success: true,
      flyer_id: flyerId,
      drive_url: driveUrl,
      download_url: downloadUrl ?? null,
      flyer: updated ?? null,
    });
  } catch (err: any) {
    console.error("POST /deliver error:", err);
    return errJson("Erro inesperado no deliver", err, 500);
  }
}
