import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../src/categories";
import { loadRanking, RANKING_LIMIT, type RankingItem } from "../src/ranking";
import { insertCombo, insertSentence } from "./fixtures";
import { createClient } from "./helpers";

// 水曜日の昼に固定する。今日は1月9日、今週は1月7日（月曜日）から
const NOW = Date.parse("2030-01-09T12:00:00+09:00");
const TODAY = Date.parse("2030-01-09T00:00:00+09:00");
const WEEK = Date.parse("2030-01-07T00:00:00+09:00");
const ids = (items: RankingItem[]) => items.map((i) => i.sentenceId);

describe("ランキングの読み出し", () => {
  it("文は作った日時で期間に振り分けられる", async () => {
    // a: 今日の0時ちょうど、b: 今日の0時の1ミリ秒前、c: 今週の月曜日の0時、d: 月曜日の0時の1ミリ秒前
    const a = await insertSentence(await insertCombo(), 900001, TODAY);
    const b = await insertSentence(await insertCombo(), 900002, TODAY - 1);
    const c = await insertSentence(await insertCombo(), 900003, WEEK);
    const d = await insertSentence(await insertCombo(), 900004, WEEK - 1);
    const r = await loadRanking(env.DB, NOW);
    const mine = (items: RankingItem[]) => ids(items).filter((id) => [a, b, c, d].includes(id));
    expect(mine(r.today)).toEqual([a]);
    expect(mine(r.week)).toEqual([c, b, a]);
    expect(mine(r.all)).toEqual([d, c, b, a]);
  });

  it("いいねの数が同じ文は同じ順位で、作った日時が早いほうが先。次の文の順位は2つあく", async () => {
    const x = await insertSentence(await insertCombo(), 800000, TODAY + 1);
    const y = await insertSentence(await insertCombo(), 800000, TODAY + 2);
    const z = await insertSentence(await insertCombo(), 799999, TODAY + 3);
    const r = await loadRanking(env.DB, NOW);
    const [ix, iy, iz] = [x, y, z].map((id) => r.today.find((i) => i.sentenceId === id));
    if (!ix || !iy || !iz) throw new Error("入れた文がランキングにない");
    expect(ids(r.today).indexOf(x)).toBeLessThan(ids(r.today).indexOf(y));
    expect(iy.rank).toBe(ix.rank);
    expect(iz.rank).toBe(ix.rank + 2);
  });

  it("hidden の部分を含む文と、いいねが0の文は出ない", async () => {
    const combo = await insertCombo();
    const hiddenOne = await insertSentence(combo, 600000, TODAY);
    await env.DB.prepare("UPDATE parts SET hidden = 1 WHERE id = ?").bind(combo[3]).run();
    const zero = await insertSentence(await insertCombo(), 0, TODAY);
    const r = await loadRanking(env.DB, NOW);
    expect(ids(r.all)).not.toContain(hiddenOne);
    expect(ids(r.all)).not.toContain(zero);
  });

  it("同期モードの文も並び、部分は分類の順で6つ返る", async () => {
    const combo = await insertCombo();
    const s = await insertSentence(combo, 600001, TODAY, "sync");
    const item = (await loadRanking(env.DB, NOW)).today.find((i) => i.sentenceId === s);
    expect(item?.likeCount).toBe(600001);
    expect(item?.parts.map((p) => p.category)).toEqual([...CATEGORIES]);
  });

  // ほかのテストの文を上位から押し出すので、このブロックの最後に置く
  it("上位50件まで", async () => {
    const old = NOW - 365 * 24 * 60 * 60 * 1000;
    const inserted: number[] = [];
    for (let i = 0; i < RANKING_LIMIT + 1; i++) inserted.push(await insertSentence(await insertCombo(), 2000000 + i, old));
    const r = await loadRanking(env.DB, NOW);
    expect(r.all).toHaveLength(RANKING_LIMIT);
    expect(ids(r.all)).toEqual(inserted.slice(1).reverse());
  });
});

describe("ランキングの API", () => {
  it("GET は 200 で、3つの期間を返す", async () => {
    const res = await createClient().get("/api/ranking");
    expect(res.status).toBe(200);
    const body = await res.json<Record<string, unknown>>();
    expect(Object.keys(body).sort()).toEqual(["all", "today", "week"]);
  });

  it("匿名のIDを作らず、Cookie も渡さない", async () => {
    const count = () => env.DB.prepare("SELECT COUNT(*) AS n FROM players").first<{ n: number }>();
    const before = await count();
    const res = await createClient().get("/api/ranking");
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(await count()).toEqual(before);
  });

  it("POST は 404", async () => {
    expect((await createClient().post("/api/ranking", {})).status).toBe(404);
  });
});
