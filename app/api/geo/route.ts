import { NextRequest } from "next/server";

function readCountryFromHeaders(request: NextRequest): string | null {
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-country-code");

  return country ? country.toUpperCase() : null;
}

/** Country only from the edge. Never send the client IP to a third-party geo API. */
export async function GET(request: NextRequest) {
  return Response.json({ country: readCountryFromHeaders(request) });
}
