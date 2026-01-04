"use client";
import { useState } from "react";

export default function Chat() {
  const [msg, setMsg] = useState("");

  async function send() {
    const chat = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: msg }),
    }).then(r => r.json());

    await fetch("/api/orchestrator", {
      method: "POST",
      body: JSON.stringify({
        tarefa: chat.tarefa,
        prompt: msg,
      }),
    });

    setMsg("");
  }

  return (
    <div style={{ flex: 2, padding: 20 }}>
      <h2>Assistente</h2>
      <input value={msg} onChange={e => setMsg(e.target.value)} />
      <button onClick={send}>Enviar</button>
    </div>
  );
}