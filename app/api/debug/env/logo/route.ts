import { NextResponse } from "next/server";
import { pickLogo } from "@/lib/logos";

export async function GET() {
  const logo = pickLogo({
    brand: "seguros",
    background: "photo",
    format: "instagram_feed",
    preferColor: true,
  });

  return NextResponse.json({ logo });
}
