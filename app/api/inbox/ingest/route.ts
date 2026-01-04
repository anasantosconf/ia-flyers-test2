import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/inbox/ingest" });
}

export async function POST() {
  return NextResponse.json({ ok: true, msg: "POST ok" });
}
