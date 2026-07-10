import { NextRequest } from "next/server";

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) {
      return ip;
    }
  }

  return request.headers.get("x-real-ip");
}

function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1") {
    return true;
  }

  if (ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return true;
  }

  const parts = ip.split(".");
  if (parts.length === 4 && parts[0] === "172") {
    const secondOctet = Number(parts[1]);
    return secondOctet >= 16 && secondOctet <= 31;
  }

  return false;
}

function readCountryFromHeaders(request: NextRequest): string | null {
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-country-code");

  return country ? country.toUpperCase() : null;
}

async function readCountryFromIp(ip: string): Promise<string | null> {
  if (isPrivateIp(ip)) {
    return null;
  }

  try {
    const response = await fetch(`https://ipapi.co/${ip}/country/`, {
      headers: { Accept: "text/plain" },
      next: { revalidate: 86_400 },
    });

    if (!response.ok) {
      return null;
    }

    const country = (await response.text()).trim().toUpperCase();
    return /^[A-Z]{2}$/.test(country) ? country : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const headerCountry = readCountryFromHeaders(request);
  if (headerCountry) {
    return Response.json({ country: headerCountry });
  }

  const ip = getClientIp(request);
  if (!ip) {
    return Response.json({ country: null });
  }

  const country = await readCountryFromIp(ip);
  return Response.json({ country });
}
