import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { insertPart, playerIdOf } from "./fixtures";
import { createClient } from "./helpers";

async function clientWithId() {
  const client = createClient();
  await client.get("/api/gacha");
  return { client, playerId: await playerIdOf(client.cookie) };
}

async function addReportLog(playerId: string, count: number) {
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    await env.DB.prepare("INSERT INTO action_log (player_id, action, created_at) VALUES (?, 'report', ?)").bind(playerId, now - 1000).run();
  }
}

describe("通報", () => {
  it("部分を通報すると reports に status=open の行ができる", async () => {
    const partId = await insertPart("who", "通報される人が");
    const { client, playerId } = await clientWithId();
    const res = await client.post("/api/reports", { partId });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reported: true });
    const row = await env.DB.prepare("SELECT status FROM reports WHERE part_id = ? AND reporter_id = ?").bind(partId, playerId).first();
    expect(row).toEqual({ status: "open" });
  });

  it("存在しない部分のIDは 404", async () => {
    const { client } = await clientWithId();
    expect((await client.post("/api/reports", { partId: 99_999_999 })).status).toBe(404);
  });

  it("隠した部分は 404", async () => {
    const partId = await insertPart("who", "隠した人が", true);
    const { client } = await clientWithId();
    expect((await client.post("/api/reports", { partId })).status).toBe(404);
  });

  it("同じ人が同じ部分を2回通報すると 409", async () => {
    const partId = await insertPart("who", "二度通報される人が");
    const { client } = await clientWithId();
    expect((await client.post("/api/reports", { partId })).status).toBe(200);
    expect((await client.post("/api/reports", { partId })).status).toBe(409);
  });

  it("別の人は同じ部分を通報できる", async () => {
    const partId = await insertPart("who", "二人に通報される人が");
    expect((await (await clientWithId()).client.post("/api/reports", { partId })).status).toBe(200);
    expect((await (await clientWithId()).client.post("/api/reports", { partId })).status).toBe(200);
  });

  it("20回目は通り、21回目は 429", async () => {
    const a = await clientWithId();
    await addReportLog(a.playerId, 19);
    expect((await a.client.post("/api/reports", { partId: await insertPart("who", "二十回目の人が") })).status).toBe(200);
    const b = await clientWithId();
    await addReportLog(b.playerId, 20);
    expect((await b.client.post("/api/reports", { partId: await insertPart("who", "二十一回目の人が") })).status).toBe(429);
  });

  it.each([{ partId: "1" }, { partId: 0 }, { partId: 1.5 }, {}, [1]])("本文 %j は 400", async (body) => {
    const { client } = await clientWithId();
    expect((await client.post("/api/reports", body)).status).toBe(400);
  });

  it("banned_at がある人は 403", async () => {
    const partId = await insertPart("who", "通報される人が");
    const { client, playerId } = await clientWithId();
    await env.DB.prepare("UPDATE players SET banned_at = 1 WHERE id = ?").bind(playerId).run();
    expect((await client.post("/api/reports", { partId })).status).toBe(403);
  });

  it("ほかの Origin からは 403", async () => {
    const partId = await insertPart("who", "通報される人が");
    const { client } = await clientWithId();
    expect((await client.post("/api/reports", { partId }, "https://evil.example")).status).toBe(403);
  });
});
