"use client";

import { useState } from "react";
import FlyerPreview from "../../components/FlyerPreview";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [text, setText] = useState("");

  const gerarFlyer = async () => {
    try {
      const res = await fetch("/api/generateFlyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();

      if (data.ok) {
        setText(data.text);
      } else {
        setText("Erro: " + data.error);
      }
    } catch (err: unknown) {
      if (err instanceof Error) setText("Erro ao chamar API: " + err.message);
      else setText("Erro desconhecido");
    }
  };

  return (
    <main style={{ padding: 20 }}>
      <h1>Assistente de Flyers</h1>
      <textarea
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Digite o que você quer no flyer"
        style={{ width: "100%", marginBottom: 10 }}
      />
      <button onClick={gerarFlyer} style={{ padding: "10px 20px" }}>
        Gerar Flyer
      </button>

      <FlyerPreview text={text} />
    </main>
  );
}