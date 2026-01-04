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
  brand: string;
  format: string;
  status: string;
  preview_base64?: string | null;
  created_at: string;
};

type InboxMessage = {
  id: string;
  from_name: string | null;
  from_phone: string | null;
  text: string;
  channel: string;
  classification: string | null;
  processed: boolean;
  created_at: string;
};

export default function Home() {
  const [message, setMessage] = useState("");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);

  async function loadAll() {
    try {
      const [tasksRes, flyersRes, inboxRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/flyers"),
        fetch("/api/inbox"),
      ]);

      const tasksData = await tasksRes.json();
      const flyersData = await flyersRes.json();
      const inboxData = await inboxRes.json();

      setTasks(tasksData || []);
      setFlyers(flyersData || []);
      setInbox(inboxData || []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadAll();

    // 🔁 Atualiza inbox automaticamente a cada 5s
    const interval = setInterval(() => {
      fetch("/api/inbox")
        .then((r) => r.json())
        .then((data) => setInbox(data || []))
        .catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  async function approveFlyer(id: string) {
    try {
      const res = await fetch(`/api/flyers/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Erro ao aprovar");
        return;
      }

      // atualiza lista
      setFlyers((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: "APROVADO" } : f))
      );
    } catch (err) {
      console.error(err);
      alert("Erro ao aprovar flyer");
    }
  }

  async function sendMessage() {
    if (!message) return;

    try {
      // 1) Chat classifica intenção
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const chatData = await chatRes.json();
      const aiRaw = chatData.ai;

      let aiJson: any = null;
      try {
        aiJson = JSON.parse(aiRaw);
      } catch (err) {
        console.error("AI não retornou JSON:", aiRaw);
        alert("A IA não retornou JSON válido. Veja console.");
        return;
      }

      // 2) Orchestrator decide ação
      const orchRes = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiJson),
      });

      const orchData = await orchRes.json();

      // 3) Executa ação
      if (orchData.action === "GERAR_FLYER") {
        // gera imagem
        const genRes = await fetch("/api/generateFlyerImage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orchData.data),
        });

        const genData = await genRes.json();

        if (!genData.success) {
          alert(genData.error || "Erro ao gerar flyer");
          return;
        }

        // salva no Supabase (flyers table)
        const flyerRes = await fetch("/api/flyers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: orchData.data.prompt,
            from: "site",
            brand: orchData.data.brand,
            format: orchData.data.format,
            previewBase64: genData.previewBase64,
          }),
        });

        const flyerData = await flyerRes.json();
        if (flyerData.success) {
          setFlyers((prev) => [flyerData.flyer, ...prev]);
        }
      }

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
        if (taskData.success) {
          setTasks((prev) => [taskData.task, ...prev]);
        }
      }

      setMessage("");
    } catch (err) {
      console.error(err);
      alert("Erro inesperado ao processar. Veja console.");
    }
  }

  return (
    <div style={{ padding: "1.5rem", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginBottom: "1rem" }}>🧠 Assistente Confi — Painel</h1>

      {/* Input */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite seu pedido..."
          style={{ flex: 1, padding: "0.75rem", borderRadius: 8, border: "1px solid #ddd" }}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: "0.75rem 1.25rem",
            borderRadius: 8,
            border: "none",
            background: "#000",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Enviar
        </button>
      </div>

      {/* Layout 3 colunas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
        {/* Inbox */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>📥 Inbox (externo)</h2>
          {inbox.length === 0 && <p>Nenhuma mensagem ainda.</p>}
          <ul style={{ paddingLeft: "1rem" }}>
            {inbox.map((m) => (
              <li key={m.id} style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {m.channel} • {new Date(m.created_at).toLocaleString()}
                </div>
                <div style={{ fontWeight: 700 }}>
                  {m.from_name || m.from_phone || "Contato"}:
                </div>
                <div>{m.text}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  processed: {String(m.processed)} • classification:{" "}
                  {m.classification || "—"}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Tasks */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>📋 Tarefas / Anotações</h2>
          {tasks.length === 0 && <p>Nenhuma tarefa registrada.</p>}
          <ul style={{ paddingLeft: "1rem" }}>
            {tasks.map((t) => (
              <li key={t.id} style={{ marginBottom: "0.75rem" }}>
                <strong>[{t.status}]</strong> {t.texto}
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {t.origem} • {new Date(t.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Flyers */}
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>🟣 Flyers</h2>
          {flyers.length === 0 && <p>Nenhum flyer ainda.</p>}
          <ul style={{ paddingLeft: "1rem" }}>
            {flyers.map((f) => (
              <li key={f.id} style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 700 }}>
                  [{f.status}] {f.brand} • {f.format}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {f.from_source} • {new Date(f.created_at).toLocaleString()}
                </div>
                <div style={{ marginTop: 6 }}>{f.prompt}</div>

                {/* Preview */}
                {f.preview_base64 && (
                  <img
                    src={`data:image/png;base64,${f.preview_base64}`}
                    alt="Preview Flyer"
                    style={{
                      width: "100%",
                      maxWidth: 300,
                      marginTop: "0.75rem",
                      borderRadius: 12,
                      border: "1px solid #eee",
                    }}
                  />
                )}

                {/* Aprovar */}
                {f.status === "AGUARDANDO_APROVACAO" && (
                  <button
                    onClick={() => approveFlyer(f.id)}
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.6rem 1rem",
                      borderRadius: 8,
                      border: "none",
                      background: "#ffce0a",
                      color: "#000",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    ✅ Aprovar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ marginTop: "1.25rem" }}>
        <button
          onClick={loadAll}
          style={{
            padding: "0.6rem 1rem",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          🔄 Atualizar tudo
        </button>
      </div>
    </div>
  );
}
