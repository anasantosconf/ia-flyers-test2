import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function testeImagem() {
  const prompt = "Flyer de seguro residencial moderno e acolhedor";

  const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024"
  });

  console.log("URL da imagem:", result.data[0].url);
}

testeImagem();