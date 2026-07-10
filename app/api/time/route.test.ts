// @vitest-environment node

import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/time/route";

describe("GET /api/time", () => {
  it("returns a UTC timestamp from the runtime clock", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(body.source).toBe("lockbox-runtime");
    expect(body.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof body.unix).toBe("number");
  });
});
