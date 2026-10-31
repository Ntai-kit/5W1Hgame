export type Action = "gacha" | "like" | "report";

export type ConsumeResult = { ok: true } | { ok: false; retryAfterSec: number };

// 数えることと記録することを1つの文で行い、同時の要求でも上限を超えないようにする
export async function tryConsume(
  db: D1Database,
  playerId: string,
  action: Action,
  limit: number,
  windowMs: number,
  now: number,
): Promise<ConsumeResult> {
  const since = now - windowMs;
  const inserted = await db
    .prepare(
      `INSERT INTO action_log (player_id, action, created_at)
       SELECT ?1, ?2, ?3
       WHERE (SELECT COUNT(*) FROM action_log WHERE player_id = ?1 AND action = ?2 AND created_at > ?4) < ?5`,
    )
    .bind(playerId, action, now, since, limit)
    .run();
  if (inserted.meta.changes > 0) return { ok: true };

  const oldest = await db
    .prepare("SELECT MIN(created_at) AS t FROM action_log WHERE player_id = ? AND action = ? AND created_at > ?")
    .bind(playerId, action, since)
    .first<{ t: number | null }>();
  const waitMs = (oldest?.t ?? now) + windowMs - now;
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil(waitMs / 1000)) };
}
