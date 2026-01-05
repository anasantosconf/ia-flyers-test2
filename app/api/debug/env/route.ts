import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    NODE_ENV: process.env.NODE_ENV,
    has_SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    has_SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    has_NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    has_NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    has_NEXT_PUBLIC_BASE_URL: Boolean(process.env.NEXT_PUBLIC_BASE_URL),
    has_MAKE_WEBHOOK_URL: Boolean(process.env.MAKE_WEBHOOK_URL),
    supabase_url_prefix: process.env.SUPABASE_URL?.slice(0, 25) ?? null,
  });
}
