"use client";

import { useEffect, useState } from "react";

type Task = {
  id: string;
  texto: string;
  origem: string;
  status: string;
  created_at: string;
};

type Flyer = {
  id: string;
  prompt: string;
  from_source: string;
  status: string;
  created_at: string;
  preview_base64?: string | null;
  brand?: string | null;
  format?: string | null;
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [message, setMessage] = useState("");

  // Loading para botão aprovar (por flyer)
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Carregar dados iniciais
  useEffect(() => {
    refreshData();
  }, []);

  async function refreshData() {
    try {
      const [tasksRes, flyersRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/flyers"),
      ]);

      const tasksData = await tasksRes.json();
      const flyersData = await flyersRes.json();

      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setFlyers(Array.isArray(flyersData) ? flyersData : []);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar dados.");
    }
  }

  // Enviar mensagem (fluxo: chat -> orchestrator -> cria task ou flyer)
  async function sendMessage() {
    try {
      if (!message.trim()) return;

      // 1) Chama /api/chat para classificar e retornar JSON
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const chatData = await chatRes.json();

      // chatData deve ser JSON com tipo/resposta/prompt
      // Se sua rota /api/chat estiver retornando { ai: "..." }, ajuste aqui:
      const aiPayload =
        typeof chatData?.ai === "string" ? safeParseJson(chatData.ai) : chatData;

      if (!aiPayload?.tipo) {
        alert("Não consegui interpretar a resposta da IA.");
        console.log("Resposta IA:", chatData);
        return;
      }

      // 2) Chama o orchestrator com esse JSON
      const orchRes = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiPayload),
      });

      const orchData = await orchRes.json();

      // 3) Executa ações com base no orchestrator
      if (orchData.action === "CRIAR_TAREFA") {
        const taskRes = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texto: orchData.data?.descricao || aiPayload.prompt || message,
            origem: "site",
          }),
        });

        const taskJson = await taskRes.json();
        if (taskJson?.task) setTasks((prev) => [taskJson.task, ...prev]);
      }

      if (orchData.action === "GERAR_FLYER") {
        // 3.1 cria flyer no banco
        const flyerRes = await fetch("/api/flyers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: orchData.data?.prompt || aiPayload.prompt || message,
            from: "site",
            brand: orchData.data?.brand || "Confi Seguros",
            format: orchData.data?.format || "instagram_feed",
          }),
        });

        const flyerJson = await flyerRes.json();
        const createdFlyer: Flyer | null = flyerJson?.flyer || null;

        if (createdFlyer) {
          // 3.2 gera imagem com identidade visual
          const genRes = await fetch("/api/generateFlyerImage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: createdFlyer.prompt,
              brand: createdFlyer.brand || "Confi Seguros",
              format: createdFlyer.format || "instagram_feed",
            }),
          });

          const genJson = await genRes.json();

          // atualiza lista local: adiciona flyer com preview
          setFlyers((prev) => [
            {
              ...createdFlyer,
              preview_base64: genJson?.previewBase64 || null,
              status: "GERADO",
            },
            ...prev,
          ]);
        }
      }

      setMessage("");
    } catch (err) {
      console.error(err);
      alert("Erro inesperado ao processar a mensagem. Veja o console.");
    }
  }

  // Aprovar flyer
  async function approveFlyer(flyerId: string) {
    try {
      setApprovingId(flyerId);

      const res = await fetch(`/api/flyers/${flyerId}/approve`, {
        method: "POST",
      });

      const data = await res.json();

      if (!data?.success) {
        alert(data?.error || "Erro ao aprovar flyer");
        return;
      }

      // Atualiza status na UI
      setFlyers((prev) =>
        prev.map((f) => (f.id === flyerId ? { ...f, status: "APROVADO" } : f))
      );
    } catch (err) {
      console.error(err);
      alert("Erro inesperado ao aprovar flyer");
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ fontSize: 26, marginBottom: 10 }}>🧠 Assistente Confi</h1>

      {/* Input */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite seu pedido..."
          style={{
            width: "100%",
            padding: "0.9rem",
            borderRadius: 12,
            border: "1px solid #ddd",
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: "0.9rem 1.1rem",
            borderRadius: 12,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            cursor: "pointer",
          }}
        >
          Enviar
        </button>

        <button
          onClick={refreshData}
          style={{
            padding: "0.9rem 1.1rem",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
          }}
        >
          Atualizar
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Tarefas */}
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 16,
            padding: 16,
            minHeight: 300,
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>📋 Tarefas / Anotações</h2>

          {tasks.length === 0 && <p>Nenhuma tarefa registrada.</p>}

          <ul style={{ paddingLeft: 18 }}>
            {tasks.map((t) => (
              <li key={t.id} style={{ marginBottom: 10 }}>
                <b>[{t.status}]</b> {t.texto}{" "}
                <span style={{ opacity: 0.6 }}>({t.origem})</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Flyers */}
        <section
          style={{
            border: "1px solid #eee",
            borderRadius: 16,
            padding: 16,
            minHeight: 300,
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>🟣 Flyers</h2>

          {flyers.length === 0 && <p>Nenhum flyer registrado.</p>}

          <ul style={{ listStyle: "none", paddingLeft: 0 }}>
            {flyers.map((f) => (
              <li
                key={f.id}
                style={{
                  border: "1px solid #f1f1f1",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <b>[{f.status}]</b> <span style={{ opacity: 0.8 }}>{f.prompt}</span>
                    <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                      origem: {f.from_source} • {f.brand || "Confi Seguros"} •{" "}
                      {f.format || "instagram_feed"}
                    </div>
                  </div>

                  {/* Botão Aprovar */}
                  {f.status !== "APROVADO" ? (
                    <button
                      onClick={() => approveFlyer(f.id)}
                      disabled={approvingId === f.id}
                      style={{
                        height: 40,
                        padding: "0 14px",
                        borderRadius: 12,
                        border: "1px solid #111",
                        background: approvingId === f.id ? "#999" : "#111",
                        color: "white",
                        cursor: approvingId === f.id ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {approvingId === f.id ? "Aprovando..." : "Aprovar ✅"}
                    </button>
                  ) : (
                    <span style={{ fontSize: 13, color: "#0a7b28", fontWeight: 700 }}>
                      ✅ Aprovado
                    </span>
                  )}
                </div>

                {/* Preview */}
                {f.preview_base64 && (
                  <img
                    src={`data:image/png;base64,${f.preview_base64}`}
                    alt="Preview Flyer"
                    style={{
                      width: "100%",
                      maxWidth: 420,
                      marginTop: 12,
                      borderRadius: 12,
                      border: "1px solid #eee",
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

/** Tenta converter string JSON em objeto */
function safeParseJson(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
