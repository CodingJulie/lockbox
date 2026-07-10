// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/geo/route";

describe("GET /api/geo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the Vercel country header and does not contact a geo API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(
      new NextRequest("http://localhost/api/geo", {
        headers: { "x-vercel-ip-country": "ru" },
      })
    );
    expect(await res.json()).toEqual({ country: "RU" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null without sending the client IP to a third party", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(
      new NextRequest("http://localhost/api/geo", {
        headers: { "x-forwarded-for": "203.0.113.9" },
      })
    );
    expect(await res.json()).toEqual({ country: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
