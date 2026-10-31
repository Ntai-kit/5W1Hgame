import { env } from "cloudflare:test";
import { expect, it } from "vitest";

it("マイグレーションのあとに必要な表がある", async () => {
  const { results } = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>();
  expect(results.map((r) => r.name)).toEqual(
    expect.arrayContaining(["players", "parts", "sentences", "likes", "reports", "last_draws", "action_log"]),
  );
});
