import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../src/categories";
import { insertPart, insertPlayer, playerIdOf, setLastDraw } from "./fixtures";
import { createClient } from "./helpers";

type LikeBody = { sentenceId: number; likeCount: number; liked: boolean };

// 新しい組み合わせを作る（ほかのテストと重ならないよう、毎回新しい部分を入れる）
async function newCombo(): Promise<number[]> {
  const ids: number[] = [];
  for (const c of CATEGORIES) ids.push(await insertPart(c, `${c}${crypto.randomUUID().slice(0, 8)}`));
  return ids;
}

// Cookie を持った利用者を作り、その人が combo を引いたことにする
async function clientWhoDrew(combo: number[]) {
  const client = createClient();
  await client.get("/api/ping");
  const playerId = await playerIdOf(client.cookie);
  await setLastDraw(playerId, combo);
  return { client, playerId };
}

async function addLikeLog(playerId: string, count: number) {
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    await env.DB.prepare("INSERT INTO action_log (player_id, action, created_at) VALUES (?, 'like', ?)").bind(playerId, now - 1000).run();
  }
}

describe("いいね", () => {
  it("引いた組み合わせにいいねすると、文が保存され like_count が 1 になる", async () => {
    const combo = await newCombo();
    const { client } = await clientWhoDrew(combo);
    const res = await client.post("/api/likes", { partIds: combo });
    expect(res.status).toBe(200);
    const body = await res.json<LikeBody>();
    expect(body.likeCount).toBe(1);
    expect(body.liked).toBe(true);
    const row = await env.DB.prepare("SELECT mode, like_count FROM sentences WHERE id = ?").bind(body.sentenceId).first();
    expect(row).toEqual({ mode: "gacha", like_count: 1 });
  });

  it("別の人が同じ組み合わせにいいねすると、同じ文の like_count が 2 になる", async () => {
    const combo = await newCombo();
    const a = await clientWhoDrew(combo);
    const b = await clientWhoDrew(combo);
    const first = await (await a.client.post("/api/likes", { partIds: combo })).json<LikeBody>();
    const second = await (await b.client.post("/api/likes", { partIds: combo })).json<LikeBody>();
    expect(second.sentenceId).toBe(first.sentenceId);
    expect(second.likeCount).toBe(2);
  });

  it("同じ人の2回目のいいねは 409 で、like_count は変わらない", async () => {
    const combo = await newCombo();
    const { client } = await clientWhoDrew(combo);
    const first = await (await client.post("/api/likes", { partIds: combo })).json<LikeBody>();
    expect((await client.post("/api/likes", { partIds: combo })).status).toBe(409);
    const row = await env.DB.prepare("SELECT like_count FROM sentences WHERE id = ?").bind(first.sentenceId).first<{ like_count: number }>();
    expect(row?.like_count).toBe(1);
  });

  it("同じ人が同時に2回送っても、いいねは1つ", async () => {
    const combo = await newCombo();
    const { client } = await clientWhoDrew(combo);
    const results = await Promise.all([client.post("/api/likes", { partIds: combo }), client.post("/api/likes", { partIds: combo })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const row = await env.DB.prepare(
      "SELECT like_count FROM sentences WHERE mode = 'gacha' AND when_part_id = ? AND what_part_id = ?",
    )
      .bind(combo[0], combo[5])
      .first<{ like_count: number }>();
    expect(row?.like_count).toBe(1);
  });

  it("引いていない組み合わせは 400", async () => {
    const drawn = await newCombo();
    const other = await newCombo();
    const { client } = await clientWhoDrew(drawn);
    expect((await client.post("/api/likes", { partIds: other })).status).toBe(400);
    const tampered = [...drawn];
    tampered[2] = other[2]!;
    expect((await client.post("/api/likes", { partIds: tampered })).status).toBe(400);
  });

  it("まだ一度も引いていない人は 400", async () => {
    const combo = await newCombo();
    const client = createClient();
    expect((await client.post("/api/likes", { partIds: combo })).status).toBe(400);
  });

  it.each([
    { partIds: [1, 2, 3, 4, 5] },
    { partIds: ["1", "2", "3", "4", "5", "6"] },
    { partIds: [-1, 2, 3, 4, 5, 6] },
    { partIds: [1.5, 2, 3, 4, 5, 6] },
    {},
    "text",
  ])("本文 %j は 400", async (body) => {
    const combo = await newCombo();
    const { client } = await clientWhoDrew(combo);
    expect((await client.post("/api/likes", body)).status).toBe(400);
  });

  it("JSON として読めない本文は 400", async () => {
    const combo = await newCombo();
    const { client } = await clientWhoDrew(combo);
    const res = await client.postRaw("/api/likes", "{not json");
    expect(res.status).toBe(400);
  });

  it("banned_at がある人は 403", async () => {
    const combo = await newCombo();
    const { client, playerId } = await clientWhoDrew(combo);
    await env.DB.prepare("UPDATE players SET banned_at = 1 WHERE id = ?").bind(playerId).run();
    expect((await client.post("/api/likes", { partIds: combo })).status).toBe(403);
  });

  it("ほかの Origin からは 403", async () => {
    const combo = await newCombo();
    const { client } = await clientWhoDrew(combo);
    expect((await client.post("/api/likes", { partIds: combo }, "https://evil.example")).status).toBe(403);
  });

  it("30回目は通り、31回目は 429", async () => {
    const thirtieth = await clientWhoDrew(await newCombo());
    await addLikeLog(thirtieth.playerId, 29);
    const combo30 = (await env.DB.prepare(
      "SELECT when_part_id, where_part_id, who_part_id, why_part_id, how_part_id, what_part_id FROM last_draws WHERE player_id = ?",
    )
      .bind(thirtieth.playerId)
      .first<Record<string, number>>())!;
    expect((await thirtieth.client.post("/api/likes", { partIds: Object.values(combo30) })).status).toBe(200);

    const combo = await newCombo();
    const over = await clientWhoDrew(combo);
    await addLikeLog(over.playerId, 30);
    const res = await over.client.post("/api/likes", { partIds: combo });
    expect(res.status).toBe(429);
    expect((await res.json<{ retryAfterSec: number }>()).retryAfterSec).toBeGreaterThan(0);
  });
});
