import { NextResponse } from "next/server";

let activities: any[] = [];

export async function GET() {
  return NextResponse.json({ activities });
}

export async function POST(req: Request) {
  const data = await req.json();

  const activity = {
    id: Date.now(),
    type: data.type,
    description: data.description,
    status: "PENDENTE",
    createdAt: new Date().toISOString(),
  };

  activities.unshift(activity);

  return NextResponse.json(activity);
}

export async function PATCH(req: Request) {
  const { id, status } = await req.json();

  activities = activities.map(a =>
    a.id === id ? { ...a, status } : a
  );

  return NextResponse.json({ success: true });
}