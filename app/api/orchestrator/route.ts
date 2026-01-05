import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * TIPOS DE CLASSIFICAÇÃO DO INBOX
 */
type InboxClassification = "GERAR_FLYER" | "CRIAR_TAREFA" | "CONVERSA";

/**
 * SAÍDA DO MODELO (IA)
 */
type AIResult = {
  classification: InboxClassification;
  summary: string;
  // se for flyer
  flyer?: {
    prompt: string;
    brand?: string;
    format?: string; // instagram_feed | instagram_story | whatsapp
  };
  // se for tarefa
  task?: {
    texto: string;
  };
};

const DEFAULT_BRAND = "Confi Seguros";
const DEFAULT_FORMAT = "instagram_feed";

/**
 * Monta o prompt do modelo para classificar e extrair dados.
 */
function buildClassifierPrompt(text: string) {
  return `
Você é um assistente de marketing e organização pessoal.
Analise a mensagem recebida e classifique em 1 categoria:

1) GERAR_FLYER -> quando a pessoa pede material, arte, post, flyer, banner, criativo, divulgação.
2) CRIAR_TAREFA -> quando a mensagem é um pedido de anotação, compromisso, lembrete, tarefa.
3) CONVERSA -> quando é apenas conversa, sem ação imediata.

Depois:
- Gere um summary curto (1 linha) do que foi entendido.
- Se for GERAR_FLYER, retorne flyer.prompt com um prompt completo para gerar a arte.
  Também pode sugerir flyer.brand e flyer.format se fizer sentido.
- Se for CRIAR_TAREFA, retorne task.texto com o texto da tarefa.

Regras:
- Retorne SOMENTE JSON válido (sem markdown, sem explicação).
- Não invente informações inexistentes.
- brand deve ser uma destas:
  "Confi Seguros" | "Confi Benefícios" | "Confi Finanças"
- format deve ser:
  "instagram_feed" | "instagram_story" | "whatsapp"

Mensagem recebida:
"${text}"
`.trim();
}

/**
 * Fallback simples (sem OpenAI) caso não exista OPENAI_API_KEY.
 */
function fallbackClassification(text: string): AIResult {
  const t = text.toLowerCase();

  const looksLikeFlyer =
    t.includes("flyer") ||
    t.includes("arte") ||
    t.includes("post") ||
    t.includes("banner") ||
    t.includes("criativo") ||
    t.includes("divulgação") ||
    t.includes("divulgar") ||
    t.includes("anúncio");

  const looksLikeTask =
    t.includes("anota") ||
    t.includes("anote") ||
    t.includes("lembra") ||
    t.includes("lembrete") ||
    t.includes("agenda") ||
    t.includes("compromisso") ||
    t.includes("marcar") ||
    t.includes("reunião") ||
    t.includes("ligar") ||
    t.includes("retornar");

  if (looksLikeFlyer) {
    return {
      classification: "GERAR_FLYER",
      summary: "Pedido de criação de flyer.",
      flyer: {
        prompt: text,
        brand: DEFAULT_BRAND,
        format: DEFAULT_FORMAT,
      },
    };
  }

  if (looksLikeTask) {
    return {
      classification: "CRIAR_TAREFA",
      summary: "Pedido para registrar tarefa/compromisso.",
      task: { texto: text },
    };
  }

  return {
    classification: "CONVERSA",
    summary: "Mensagem informativa/sem ação.",
  };
}

/**
 * Chama a IA (OpenAI) e tenta forçar JSON puro na resposta.
 */
async function classifyWithAI(messageText: string): Promise<AIResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackClassification(messageText);

  const openai = new OpenAI({ apiKey });

  // Usando Responses API para maior estabilidade e instruções
  const res = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "Você é um classificador. Responda apenas em JSON válido, sem markdown.",
      },
      {
        role: "user",
        content: buildClassifierPrompt(messageText),
      },
    ],
  });

  const rawText =
    res.output_text?.trim() ||
    "";

  // Segurança: se vier com texto sujo, tentar extrair JSON
  const jsonStart = rawText.indexOf("{");
  const jsonEnd = rawText.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    // fallback
    return fallbackClassification(messageText);
  }

  const jsonStr = rawText.slice(jsonStart, jsonEnd + 1);

  try {
    const parsed = JSON.parse(jsonStr);

    // validações mínimas
    const classification = parsed.classification as InboxClassification;
    const summary = (parsed.summary || "").toString();

    if (!classification || !summary) {
      return fallbackClassification(messageText);
    }

    const result: AIResult = {
      classification,
      summary,
    };

    if (classification === "GERAR_FLYER") {
      result.flyer = {
        prompt: parsed.flyer?.prompt || messageText,
        brand: parsed.flyer?.brand || DEFAULT_BRAND,
        format: parsed.flyer?.format || DEFAULT_FORMAT,
      };
    }

    if (classification === "CRIAR_TAREFA") {
      result.task = {
        texto: parsed.task?.texto || messageText,
      };
    }

    return result;
  } catch {
    return fallbackClassification(messageText);
  }
}

/**
 * Utilitário para chamar endpoint interno do próprio projeto (gerar imagem).
 */
async function callInternalGenerateFlyerImage(
  baseUrl: string,
  payload: { prompt: string; brand: string; format: string }
) {
  const r = await fetch(`${baseUrl}/api/generateFlyerImage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await r.json();
  if (!r.ok) {
    throw new Error(data?.error || "Erro ao gerar imagem");
  }
  return data as { success: boolean; previewBase64: string };
}

/**
 * Orchestrator:
 * - processa 1 ou N mensagens não processadas do inbox
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase não configurado (env vars ausentes)" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const limit = Number(body?.limit ?? 10); // processa até 10 por chamada
    const autoGenerateFlyerImage = body?.autoGenerateFlyerImage ?? true;

    /**
     * Base URL para chamar endpoints internos em produção/local.
     */
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    // 1) Buscar mensagens não processadas
    const { data: inbox, error: inboxError } = await supabaseAdmin
      .from("inbox_messages")
      .select("*")
      .eq("processed", false)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (inboxError) throw inboxError;

    if (!inbox || inbox.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: "Nada para processar." });
    }

    const results: any[] = [];

    for (const msg of inbox) {
      const msgText = msg.text || "";

      // 2) Classificar com IA
      const ai = await classifyWithAI(msgText);

      // 3) Executar ações (task / flyer)
      let createdTask: any = null;
      let createdFlyer: any = null;

      if (ai.classification === "CRIAR_TAREFA" && ai.task?.texto) {
        const { data: taskData, error: taskError } = await supabaseAdmin
          .from("tasks")
          .insert([
            {
              texto: ai.task.texto,
              origem: msg.channel || "inbox",
              status: "SALVO",
            },
          ])
          .select()
          .single();

        if (taskError) throw taskError;
        createdTask = taskData;
      }

      if (ai.classification === "GERAR_FLYER" && ai.flyer?.prompt) {
        // cria registro do flyer primeiro
        const flyerPayload = {
          prompt: ai.flyer.prompt,
          from_source: msg.channel || "inbox",
          brand: ai.flyer.brand || DEFAULT_BRAND,
          format: ai.flyer.format || DEFAULT_FORMAT,
          status: "AGUARDANDO_APROVACAO",
          preview_base64: null as string | null,
        };

        // Se autoGenerateFlyerImage estiver habilitado, gera a imagem e salva junto
        if (autoGenerateFlyerImage) {
          try {
            const img = await callInternalGenerateFlyerImage(baseUrl, {
              prompt: flyerPayload.prompt,
              brand: flyerPayload.brand,
              format: flyerPayload.format,
            });

            flyerPayload.preview_base64 = img.previewBase64;
            flyerPayload.status = "GERADO";
          } catch (e) {
            // Se falhar, não quebra tudo: salva só como aguardando aprovação
            console.error("Falha ao gerar imagem automaticamente:", e);
          }
        }

        const { data: flyerData, error: flyerError } = await supabaseAdmin
          .from("flyers")
          .insert([flyerPayload])
          .select()
          .single();

        if (flyerError) throw flyerError;
        createdFlyer = flyerData;
      }

      // 4) Atualizar mensagem do inbox: marcar como processada e salvar resumo
      const updatePayload: any = {
        processed: true,
        classification: ai.classification,
        analysis_summary: ai.summary,
      };

      // vincula flyer se criado
      if (createdFlyer?.id) {
        updatePayload.linked_flyer_id = createdFlyer.id;
      }

      const { error: updateError } = await supabaseAdmin
        .from("inbox_messages")
        .update(updatePayload)
        .eq("id", msg.id);

      if (updateError) throw updateError;

      results.push({
        inbox_id: msg.id,
        classification: ai.classification,
        summary: ai.summary,
        task: createdTask,
        flyer: createdFlyer,
      });
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (err: any) {
    console.error("orchestrator error:", err);
    return NextResponse.json(
      { error: err?.message || "Erro interno no orchestrator" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/orchestrator",
    usage: {
      method: "POST",
      body: {
        limit: 10,
        autoGenerateFlyerImage: true,
      },
    },
  });
}
