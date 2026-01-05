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
  preview_base64?: string | null;
  created_at: string;
};

type InboxMessage = {
  id: string;
  channel: string | null;
  from_name: string | null;
  from_phone: string | null;
  from_id: string | null;
  text: string;
  classification: string | null;
  processed: boolean | null;
  created_at: string;
};

export default function Home() {
  // ✅ ESTADOS
  const [message, setMessage] = useState("");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);

  // ✅ CARREGAR DADOS INICIAIS
  useEffect(() => {
    fetch("/api/tasks")
      .then((res) => res.json())
      .then(setTasks)
      .catch(console.error);

    fetch("/api/flyers")
      .then((res) => res.json())
      .then(setFlyers)
      .catch(console.error);

    fetch("/api/inbox")
      .then((res) => res.json())
      .then(setInbox)
      .catch(console.error);
  }, []);

  // ✅ ENVIAR MENSAGEM PARA O ASSISTENTE
  async function sendMessage() {
    if (!message) return;

    // 1) chama o /api/chat
    const chatRes = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const chatData = await chatRes.json();

    let aiJson: any = null;
    try {
      aiJson = JSON.parse(chatData.ai);
    } catch {
      aiJson = null;
    }

    if (!aiJson?.tipo) {
      alert("A IA não retornou JSON válido.");
      setMessage("");
      return;
    }

    // 2) chama o orchestrator
    const orchRes = await fetch("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiJson),
    });

    const orchData = await orchRes.json();

    // 3) executa ação
    if (orchData.action === "CRIAR_TAREFA") {
      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: orchData.data.descricao,
          origem: "site",
        }),
      });

      const taskData = await taskRes.json();

      setTasks((prev) => [taskData.task, ...prev]);
    }

    if (orchData.action === "GERAR_FLYER") {
      // gera imagem primeiro
      const imgRes = await fetch("/api/generateFlyerImage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: orchData.data.prompt,
          brand: orchData.data.brand,
          format: orchData.data.format,
        }),
      });

      const imgData = await imgRes.json();
      if (!imgData?.success) {
        alert("Erro ao gerar imagem: " + (imgData?.error || "desconhecido"));
        return;
      }

      // salva flyer no banco
      const flyerRes = await fetch("/api/flyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: orchData.data.prompt,
          from: "site",
          brand: orchData.data.brand,
          format: orchData.data.format,
          previewBase64: imgData.previewBase64,
        }),
      });

      const flyerData = await flyerRes.json();
      setFlyers((prev) => [flyerData.flyer, ...prev]);
    }

    setMessage("");
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>🧠 Assistente Confi</h1>

      {/* INPUT */}
      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite seu pedido..."
          style={{ width: "70%", padding: "0.5rem" }}
        />
        <button
          onClick={sendMessage}
          style={{ padding: "0.5rem 1rem", marginLeft: "0.5rem" }}
        >
          Enviar
        </button>
      </div>

      {/* GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "1.5rem",
        }}
      >
        {/* ✅ INBOX */}
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "1rem",
          }}
        >
          <h2>📥 Inbox</h2>

          {inbox.length === 0 && <p>Nenhuma mensagem ainda.</p>}

          <ul style={{ paddingLeft: "1rem" }}>
            {inbox.map((m) => (
              <li key={m.id} style={{ marginBottom: "1rem" }}>
                <strong>{m.from_name || "Sem nome"}</strong>{" "}
                <span style={{ opacity: 0.7 }}>
                  ({m.channel || "sem canal"})
                </span>
                <br />
                <span>{m.text}</span>
                <br />
                {m.classification && (
                  <small style={{ opacity: 0.7 }}>
                    Tipo: <strong>{m.classification}</strong>
                  </small>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* ✅ TASKS */}
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "1rem",
          }}
        >
          <h2>📋 Tarefas</h2>
          {tasks.length === 0 && <p>Nenhuma tarefa registrada.</p>}

          <ul style={{ paddingLeft: "1rem" }}>
            {tasks.map((t) => (
              <li key={t.id} style={{ marginBottom: "0.75rem" }}>
                [{t.status}] {t.texto} <small>({t.origem})</small>
              </li>
            ))}
          </ul>
        </div>

        {/* ✅ FLYERS */}
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "1rem",
          }}
        >
          <h2>🟣 Flyers</h2>
          {flyers.length === 0 && <p>Nenhum flyer ainda.</p>}

          <ul style={{ paddingLeft: "1rem" }}>
            {flyers.map((f) => (
              <li key={f.id} style={{ marginBottom: "1rem" }}>
                <strong>[{f.status}]</strong> {f.prompt}
                <br />
                <small style={{ opacity: 0.7 }}>
                  ({f.from_source || "site"})
                </small>

                {f.preview_base64 && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <img
                      src={`data:image/png;base64,${f.preview_base64}`}
                      alt="Preview Flyer"
                      style={{
                        width: "200px",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
