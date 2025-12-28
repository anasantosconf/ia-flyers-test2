export async function POST(req) {
  const { fileName, content } = await req.json();

  if (!fileName || !content) {
    return new Response(JSON.stringify({ error: "content e fileName são obrigatórios" }), { status: 400 });
  }

  // Futuro: aqui chamaremos a API do Google Drive
  return new Response(JSON.stringify({
    ok: true,
    message: `Arquivo ${fileName} salvo (simulado)`
  }));
}