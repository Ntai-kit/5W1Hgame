import { z } from "zod";
import { CATEGORIES, type Category } from "./categories";
import type { Config } from "./config";
import { errorResponse, json, limitedResponse } from "./http";
import type { Player } from "./player";
import { tryConsume } from "./rate-limit";

const DAY_MS = 24 * 60 * 60 * 1000;

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

  return json({ parts: parts.map((p) => ({ id: p.id, category: p.category, text: p.text })), cooldownSec: cfg.gachaIntervalSec });
}

const COMBO_WHERE =
  "mode = 'gacha' AND when_part_id = ? AND where_part_id = ? AND who_part_id = ? AND why_part_id = ? AND how_part_id = ? AND what_part_id = ?";

const LikeBody = z.object({ partIds: z.array(z.number().int().positive()).length(CATEGORIES.length) });

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

function sameCombo(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// その人が最後に引いた組み合わせにだけ、いいねを押せる。文はいいねのときに初めて保存する
export async function handleLike(req: Request, env: Env, player: Player, cfg: Config, now: number): Promise<Response> {
  const parsed = LikeBody.safeParse(await readJson(req));
  if (!parsed.success) return errorResponse(400);
  const partIds = parsed.data.partIds;
  if (player.bannedAt !== null) return errorResponse(403);

  const draw = await env.DB.prepare(
    "SELECT when_part_id, where_part_id, who_part_id, why_part_id, how_part_id, what_part_id FROM last_draws WHERE player_id = ?",
  )
    .bind(player.id)
    .first<Record<string, number>>();
  if (!draw || !sameCombo(CATEGORIES.map((c) => draw[`${c}_part_id`] ?? 0), partIds)) return errorResponse(400);

  const already = await env.DB.prepare(`SELECT 1 FROM likes JOIN sentences ON sentences.id = likes.sentence_id WHERE likes.player_id = ? AND ${COMBO_WHERE}`)
    .bind(player.id, ...partIds)
    .first();
  if (already) return errorResponse(409);

  const limit = await tryConsume(env.DB, player.id, "like", cfg.likePerDay, DAY_MS, now);
  if (!limit.ok) return limitedResponse(limit.retryAfterSec);

  // 文の保存、いいねの追加、件数の更新を1つのトランザクションで行う
  const [, liked, , sentence] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO sentences (mode, when_part_id, where_part_id, who_part_id, why_part_id, how_part_id, what_part_id, created_at)
       VALUES ('gacha', ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (when_part_id, where_part_id, who_part_id, why_part_id, how_part_id, what_part_id) WHERE mode = 'gacha' DO NOTHING`,
    ).bind(...partIds, now),
    env.DB.prepare(`INSERT OR IGNORE INTO likes (sentence_id, player_id, created_at) SELECT id, ?, ? FROM sentences WHERE ${COMBO_WHERE}`).bind(
      player.id,
      now,
      ...partIds,
    ),
    env.DB.prepare(`UPDATE sentences SET like_count = (SELECT COUNT(*) FROM likes WHERE sentence_id = sentences.id) WHERE ${COMBO_WHERE}`).bind(
      ...partIds,
    ),
    env.DB.prepare(`SELECT id, like_count FROM sentences WHERE ${COMBO_WHERE}`).bind(...partIds),
  ]);
  const row = sentence?.results[0] as { id: number; like_count: number } | undefined;
  if (!row) throw new Error("いいねした文が見つからない");
  // 同時に送られた2回目は、いいねが増えないので重複として返す
  if (!liked || liked.meta.changes === 0) return errorResponse(409);
  return json({ sentenceId: row.id, likeCount: row.like_count, liked: true });
}

const ReportBody = z.object({ partId: z.number().int().positive() });

// 通報は文の中の部分を1つ選んで行う。同じ人が同じ部分を通報できるのは1回
export async function handleReport(req: Request, env: Env, player: Player, cfg: Config, now: number): Promise<Response> {
  const parsed = ReportBody.safeParse(await readJson(req));
  if (!parsed.success) return errorResponse(400);
  const { partId } = parsed.data;
  if (player.bannedAt !== null) return errorResponse(403);

  const part = await env.DB.prepare("SELECT 1 FROM parts WHERE id = ? AND hidden = 0").bind(partId).first();
  if (!part) return errorResponse(404);

  const already = await env.DB.prepare("SELECT 1 FROM reports WHERE part_id = ? AND reporter_id = ?").bind(partId, player.id).first();
  if (already) return errorResponse(409);

  const limit = await tryConsume(env.DB, player.id, "report", cfg.reportPerDay, DAY_MS, now);
  if (!limit.ok) return limitedResponse(limit.retryAfterSec);

  const inserted = await env.DB.prepare("INSERT OR IGNORE INTO reports (part_id, reporter_id, created_at) VALUES (?, ?, ?)")
    .bind(partId, player.id, now)
    .run();
  if (inserted.meta.changes === 0) return errorResponse(409);
  return json({ reported: true });
}
