// app/api/instagram/metrics/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    likes: 124,
    comments: 8,
    reach: 1340,
    impressions: 1820,
  });
}