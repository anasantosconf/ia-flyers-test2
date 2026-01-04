// app/api/saveTestDrive/route.ts
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";

export async function POST(req: NextRequest) {
  try {
    // corpo da requisição JSON
    // {
    //   "imageBase64": "iVBORw0KGgoAAAANS...",
    //   "fileName": "teste.png"
    // }
    const { imageBase64, fileName } = await req.json();

    if (!imageBase64 || !fileName) {
      return NextResponse.json(
        { error: "imageBase64 e fileName são obrigatórios" },
        { status: 400 }
      );
    }

    // Configuração da Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: process.env.GOOGLE_TYPE,
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
      },
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    const drive = google.drive({ version: "v3", auth });

    // Converter base64 para stream
    const buffer = Buffer.from(imageBase64, "base64");
    const stream = Readable.from(buffer);

    // Enviar arquivo para Shared Drive
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!], // Shared Drive
      },
      media: {
        mimeType: "image/png",
        body: stream,
      },
      supportsAllDrives: true,
    });

    return NextResponse.json({
      message: "Arquivo enviado com sucesso!",
      fileId: response.data.id,
    });
  } catch (error) {
    console.error("Erro saveTestDrive:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}