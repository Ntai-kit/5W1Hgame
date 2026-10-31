import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createClient } from "./helpers";

async function countPlayers(): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM players").first<{ n: number }>();
  return row?.n ?? 0;
}

describe("匿名のID", () => {
  it("Cookie なしの最初の要求で pid の Cookie が付き、players に1行できる", async () => {
    const client = createClient();
    const before = await countPlayers();
    const res = await client.get("/api/gacha");
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toMatch(/^pid=[0-9a-f-]{36};/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/games/5w1h");
    expect(await countPlayers()).toBe(before + 1);
  });

  it("同じ Cookie で2回目を呼ぶと Set-Cookie は付かず、players は増えない", async () => {
    const client = createClient();
    await client.get("/api/gacha");
    const before = await countPlayers();
    const res = await client.get("/api/gacha");
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(await countPlayers()).toBe(before);
  });

  it("UUID の形でない pid は新しいIDに取り替えられる", async () => {
    const client = createClient();
    client.setCookie("pid=not-a-uuid");
    const res = await client.get("/api/gacha");
    expect(res.headers.get("Set-Cookie")).toMatch(/^pid=[0-9a-f-]{36};/);
  });

  it("UUID の形でも players にない pid は新しいIDに取り替えられる", async () => {
    const client = createClient();
    const unknown = crypto.randomUUID();
    client.setCookie(`pid=${unknown}`);
    const res = await client.get("/api/gacha");
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toMatch(/^pid=[0-9a-f-]{36};/);
    expect(setCookie).not.toContain(unknown);
    const row = await env.DB.prepare("SELECT id FROM players WHERE id = ?").bind(unknown).first();
    expect(row).toBeNull();
  });
});

describe("プレイヤーの行を作らない要求", () => {
  it.each(["/api/nothing", "/api/ping"])("Cookie なしで知らない API のパス %s を呼んでも players は増えず、Set-Cookie も付かない", async (path) => {
    const before = await countPlayers();
    const res = await createClient().get(path);
    expect(res.status).toBe(404);
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(await countPlayers()).toBe(before);
  });

  it("Cookie なしで知らない API のパスに POST しても players は増えない", async () => {
    const before = await countPlayers();
    const res = await createClient().post("/api/nothing", {});
    expect(res.status).toBe(404);
    expect(await countPlayers()).toBe(before);
  });
});
