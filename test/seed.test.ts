import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { isValidAnswerText, normalizeInput } from "../src/text-rules";

describe("運営の例", () => {
  it("分類ごとに100個ある", async () => {
    const { results } = await env.DB.prepare(
      "SELECT category, COUNT(*) AS n FROM parts WHERE source = 'seed' AND created_at = 0 AND player_id IS NULL GROUP BY category",
    ).all<{ category: string; n: number }>();
    expect(results).toHaveLength(6);
    for (const r of results) expect(r.n).toBe(100);
  });

  it("すべて文字の決まりを満たす", async () => {
    const { results } = await env.DB.prepare("SELECT text FROM parts WHERE source = 'seed' AND player_id IS NULL").all<{ text: string }>();
    const bad = results.filter((r) => !isValidAnswerText(r.text) || normalizeInput(r.text) !== r.text);
    expect(bad).toEqual([]);
  });

  it("同じ分類の中に同じ例がない", async () => {
    const { results } = await env.DB.prepare(
      "SELECT category, text FROM parts WHERE source = 'seed' AND player_id IS NULL GROUP BY category, text HAVING COUNT(*) > 1",
    ).all();
    expect(results).toEqual([]);
  });
});
