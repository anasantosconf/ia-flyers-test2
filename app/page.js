"use client";
import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);

  const handleSend = async () => {
    if (!prompt.trim()) return;

    const userMessage = { role: "user", text: prompt };
    setMessages(prev => [...prev, userMessage]);
    setPrompt("");

    try {
      const res = await fetch("/api/generateFlyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      const data = await res.json();
      const aiMessage = { role: "assistant", text: data.text };
      setMessages(prev => [...prev, aiMessage]);

    } catch (err) {
      console.error(err);
      const aiMessage = { role: "assistant", text: "Erro ao gerar flyer." };
      setMessages(prev => [...prev, aiMessage]);
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Assistente de Flyers</h1>
      <div style={{ border: "1px solid #ccc", padding: "1rem", height: "400px", overflowY: "auto", marginBottom: "1rem" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: "0.5rem", textAlign: m.role === "user" ? "right" : "left" }}>
            <b>{m.role === "user" ? "Você" : "Assistente"}:</b> {m.text}
          </div>
        ))}
      </div>
      <input
        type="text"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleSend()}
        style={{ width: "80%", padding: "0.5rem" }}
        placeholder="Digite o prompt para o flyer..."
      />
      <button onClick={handleSend} style={{ padding: "0.5rem 1rem", marginLeft: "1rem" }}>Enviar</button>
    </div>
  );
}