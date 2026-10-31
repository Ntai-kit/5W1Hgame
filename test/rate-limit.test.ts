import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { tryConsume } from "../src/rate-limit";

const pid = () => crypto.randomUUID();

describe("回数の上限", () => {
  it("上限の回数までは ok、次は ok: false", async () => {
    const p = pid();
    for (let i = 0; i < 3; i++) {
      expect(await tryConsume(env.DB, p, "like", 3, 60_000, 1000 + i)).toEqual({ ok: true });
    }
    expect((await tryConsume(env.DB, p, "like", 3, 60_000, 1003)).ok).toBe(false);
  });

  it("窓が過ぎれば、また ok になる", async () => {
    const p = pid();
    expect((await tryConsume(env.DB, p, "gacha", 1, 15_000, 0)).ok).toBe(true);
    expect((await tryConsume(env.DB, p, "gacha", 1, 15_000, 14_999)).ok).toBe(false);
    expect((await tryConsume(env.DB, p, "gacha", 1, 15_000, 15_000)).ok).toBe(true);
  });

  it("retryAfterSec は、いちばん古い記録が窓から出るまでの秒数", async () => {
    const p = pid();
    await tryConsume(env.DB, p, "gacha", 1, 15_000, 0);
    expect(await tryConsume(env.DB, p, "gacha", 1, 15_000, 5_000)).toEqual({ ok: false, retryAfterSec: 10 });
    expect(await tryConsume(env.DB, p, "gacha", 1, 15_000, 5_500)).toEqual({ ok: false, retryAfterSec: 10 });
  });

  it("同時に呼んでも上限を超えない", async () => {
    const p = pid();
    const results = await Promise.all(Array.from({ length: 5 }, () => tryConsume(env.DB, p, "report", 1, 60_000, 1000)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("人と操作ごとに別々に数える", async () => {
    const a = pid();
    const b = pid();
    expect((await tryConsume(env.DB, a, "like", 1, 60_000, 0)).ok).toBe(true);
    expect((await tryConsume(env.DB, b, "like", 1, 60_000, 0)).ok).toBe(true);
    expect((await tryConsume(env.DB, a, "report", 1, 60_000, 0)).ok).toBe(true);
  });
});
