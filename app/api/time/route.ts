import { NextResponse } from "next/server";

/** Host clock (Vercel/Node, NTP-synced). Not an RFC 3161 timestamp authority. */
export async function GET() {
  const now = new Date();
  return NextResponse.json(
    {
      iso: now.toISOString(),
      unix: Math.floor(now.getTime() / 1000),
      source: "lockbox-runtime",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
