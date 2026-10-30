import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "./helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("返事の形と Origin の検査", () => {
  it("Origin が ALLOWED_ORIGIN と違う POST は 403", async () => {
    const client = createClient();
    expect((await client.post("/api/likes", {}, "https://evil.example")).status).toBe(403);
    expect((await client.post("/api/likes", {}, null)).status).toBe(403);
  });

  it("ハンドラの例外は 500 と requestId だけを返し、例外の文面を返さない", async () => {
    vi.spyOn(env.DB, "prepare").mockImplementation(() => {
      throw new Error("SECRET internal detail players table");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await createClient().get("/api/ping");
    expect(res.status).toBe(500);
    const body = await res.json<Record<string, unknown>>();
    expect(Object.keys(body).sort()).toEqual(["error", "requestId"]);
    expect(body.error).toBe("うまくいきませんでした");
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(body)).not.toContain("SECRET");
  });

  it("API の返事には no-store と nosniff が付く", async () => {
    const res = await createClient().get("/api/ping");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("知らない API のパスは 404", async () => {
    expect((await createClient().get("/api/nothing")).status).toBe(404);
  });
});
