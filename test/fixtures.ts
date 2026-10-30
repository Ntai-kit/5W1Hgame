import { env } from "cloudflare:test";
import { CATEGORIES, type Category } from "../src/categories";

export async function insertPart(category: Category, text: string, hidden = false): Promise<number> {
  const row = await env.DB.prepare(
    "INSERT INTO parts (category, text, source, hidden, created_at) VALUES (?, ?, 'seed', ?, 0) RETURNING id",
  )
    .bind(category, text, hidden ? 1 : 0)
    .first<{ id: number }>();
  if (!row) throw new Error("insertPart failed");
  return row.id;
}

export async function insertPlayer(bannedAt: number | null = null): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO players (id, created_at, banned_at) VALUES (?, 0, ?)").bind(id, bannedAt).run();
  return id;
}

// 各分類に、見える部分を1つと隠した部分を1つ入れる。見える部分の ID を分類の順で返す
export async function insertPartsForAllCategories(): Promise<{ visible: number[]; hidden: number[] }> {
  const visible: number[] = [];
  const hidden: number[] = [];
  for (const c of CATEGORIES) {
    visible.push(await insertPart(c, `${c}の見える部分`));
    hidden.push(await insertPart(c, `${c}の隠した部分`, true));
  }
  return { visible, hidden };
}

export async function setLastDraw(playerId: string, partIds: number[]): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO last_draws (player_id, when_part_id, where_part_id, who_part_id, why_part_id, how_part_id, what_part_id, drawn_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(player_id) DO UPDATE SET when_part_id = excluded.when_part_id, where_part_id = excluded.where_part_id,
       who_part_id = excluded.who_part_id, why_part_id = excluded.why_part_id, how_part_id = excluded.how_part_id,
       what_part_id = excluded.what_part_id, drawn_at = excluded.drawn_at`,
  )
    .bind(playerId, ...partIds)
    .run();
}

export async function playerIdOf(cookie: string | null): Promise<string> {
  const id = cookie?.replace(/^pid=/, "");
  if (!id) throw new Error("no cookie");
  return id;
}
