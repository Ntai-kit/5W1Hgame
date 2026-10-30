import { CATEGORIES, type Category } from "./categories";
import type { Config } from "./config";
import { json, limitedResponse } from "./http";
import type { Player } from "./player";
import { tryConsume } from "./rate-limit";

type PartRow = { id: number; category: Category; text: string };

// 分類ごとに、隠していない部分から1つずつランダムに選ぶ。語の重みは使わない
export async function handleDraw(env: Env, player: Player, cfg: Config, now: number): Promise<Response> {
  const limit = await tryConsume(env.DB, player.id, "gacha", 1, cfg.gachaIntervalSec * 1000, now);
  if (!limit.ok) return limitedResponse(limit.retryAfterSec);

  const pick = env.DB.prepare("SELECT id, category, text FROM parts WHERE category = ? AND hidden = 0 ORDER BY RANDOM() LIMIT 1");
  const results = await env.DB.batch<PartRow>(CATEGORIES.map((c) => pick.bind(c)));
  const parts = results.map((r, i) => {
    const row = r.results[0];
    if (!row) throw new Error(`分類 ${CATEGORIES[i]} に使える部分がない`);
    return row;
  });

  await env.DB.prepare(
    `INSERT INTO last_draws (player_id, when_part_id, where_part_id, who_part_id, why_part_id, how_part_id, what_part_id, drawn_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(player_id) DO UPDATE SET when_part_id = excluded.when_part_id, where_part_id = excluded.where_part_id,
       who_part_id = excluded.who_part_id, why_part_id = excluded.why_part_id, how_part_id = excluded.how_part_id,
       what_part_id = excluded.what_part_id, drawn_at = excluded.drawn_at`,
  )
    .bind(player.id, ...parts.map((p) => p.id), now)
    .run();

  return json({ parts: parts.map((p) => ({ id: p.id, category: p.category, text: p.text })) });
}
