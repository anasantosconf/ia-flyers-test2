import OpenAI from "openai";

// Aqui você coloca sua chave literal só para teste
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // substitua pelo seu key real
});

async function teste() {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // modelo que sua chave pessoal acessa
      messages: [
        {
          role: "system",
          content: "Você é um assistente criativo de marketing que cria flyers para redes sociais.",
        },
        {
          role: "user",
          content: "Crie um flyer de seguro residencial, acolhedor e moderno",
        },
      ],
    });

    console.log("Texto gerado:", completion.choices[0].message.content);
  } catch (err) {
    console.error("Erro:", err);
  }
}

teste();