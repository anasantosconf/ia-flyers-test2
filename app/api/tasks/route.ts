import { NextRequest, NextResponse } from "next/server";

type Task = {
  id: string;
  texto: string;
  origem: string;
  status: string;
  createdAt: string;
};

export const tasks: Task[] = [];

export async function POST(req: NextRequest) {
  const { texto, origem } = await req.json();

  const task: Task = {
    id: crypto.randomUUID(),
    texto,
    origem: origem || "manual",
    status: "SALVO",
    createdAt: new Date().toISOString(),
  };

  tasks.push(task);

  return NextResponse.json({ success: true, task });
}

export async function GET() {
  return NextResponse.json(tasks);
}