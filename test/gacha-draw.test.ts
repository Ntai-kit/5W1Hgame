import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { CATEGORIES } from "../src/categories";
import { loadConfig } from "../src/config";
import { handleDraw } from "../src/gacha";
import { insertPartsForAllCategories, insertPlayer, playerIdOf } from "./fixtures";
import { createClient } from "./helpers";

type DrawBody = { parts: { id: number; category: string; text: string }[]; cooldownSec: number };

let hiddenIds: number[] = [];

beforeAll(async () => {
  ({ hidden: hiddenIds } = await insertPartsForAllCategories());
});

describe("ガチャを引く", () => {
  it("6つの分類の部分が、いつ、どこで、だれが、なぜ、どうやって、なにをしたの順で返る", async () => {
    const res = await createClient().get("/api/gacha");
    expect(res.status).toBe(200);
    const body = await res.json<DrawBody>();
    expect(body.parts.map((p) => p.category)).toEqual([...CATEGORIES]);
    for (const p of body.parts) expect(typeof p.text).toBe("string");
    expect(body.cooldownSec).toBe(15);
  });

  it("hidden の部分は出ない", async () => {
    const cfg = loadConfig(env);
    const playerId = await insertPlayer();
    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const res = await handleDraw(env, { id: playerId, bannedAt: null }, cfg, i * 16_000);
      const body = await res.json<DrawBody>();
      for (const p of body.parts) seen.add(p.id);
    }
    for (const id of hiddenIds) expect(seen.has(id)).toBe(false);
  });

  it("15秒以内の2回目は 429 と retryAfterSec", async () => {
    const client = createClient();
    expect((await client.get("/api/gacha")).status).toBe(200);
    const res = await client.get("/api/gacha");
    expect(res.status).toBe(429);
    const body = await res.json<{ retryAfterSec: number }>();
    expect(body.retryAfterSec).toBeGreaterThan(0);
    expect(body.retryAfterSec).toBeLessThanOrEqual(15);
    expect(res.headers.get("Retry-After")).toBe(String(body.retryAfterSec));
  });

  it("引いた組み合わせが last_draws に入る", async () => {
    const client = createClient();
    const body = await (await client.get("/api/gacha")).json<DrawBody>();
    const playerId = await playerIdOf(client.cookie);
    const row = await env.DB.prepare(
      "SELECT when_part_id, where_part_id, who_part_id, why_part_id, how_part_id, what_part_id FROM last_draws WHERE player_id = ?",
    )
      .bind(playerId)
      .first<Record<string, number>>();
    expect(row && Object.values(row)).toEqual(body.parts.map((p) => p.id));
  });

  it("banned_at がある人も引ける", async () => {
    const cfg = loadConfig(env);
    const playerId = await insertPlayer(1);
    const res = await handleDraw(env, { id: playerId, bannedAt: 1 }, cfg, 0);
    expect(res.status).toBe(200);
  });
});
