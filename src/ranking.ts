import { CATEGORIES, type Category } from "./categories";
import { json } from "./http";

const DAY_MS = 24 * 60 * 60 * 1000;
// 日本時間は UTC+9 で、夏時間はない
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// now を含む日本時間の日の0時と、その週の月曜日の0時を返す
export function periodStarts(now: number): { today: number; week: number } {
  const jst = now + JST_OFFSET_MS;
  const today = Math.floor(jst / DAY_MS) * DAY_MS - JST_OFFSET_MS;
  const daysSinceMonday = (new Date(jst).getUTCDay() + 6) % 7;
  return { today, week: today - daysSinceMonday * DAY_MS };
}

export const RANKING_LIMIT = 50;

export type RankingItem = { sentenceId: number; rank: number; likeCount: number; parts: { category: Category; text: string }[] };
export type Ranking = { today: RankingItem[]; week: RankingItem[]; all: RankingItem[] };

type RankingRow = { id: number; like_count: number } & Record<`${Category}_text`, string>;

// 6つの部分がどれも隠れていない文だけを、いいねの多い順に読む。いいねが0の文は出さない
const RANKING_SQL = `SELECT s.id, s.like_count, ${CATEGORIES.map((c) => `p_${c}.text AS ${c}_text`).join(", ")}
  FROM sentences s
  ${CATEGORIES.map((c) => `JOIN parts p_${c} ON p_${c}.id = s.${c}_part_id AND p_${c}.hidden = 0`).join("\n  ")}
  WHERE s.like_count > 0 AND s.created_at >= ?
  ORDER BY s.like_count DESC, s.created_at ASC, s.id ASC
  LIMIT ${RANKING_LIMIT}`;

// いいねの数が同じ文は同じ順位にする（1位、2位、2位、4位）
function toItems(rows: RankingRow[]): RankingItem[] {
  let rank = 0;
  return rows.map((row, i) => {
    if (i === 0 || row.like_count !== rows[i - 1]?.like_count) rank = i + 1;
    return {
      sentenceId: row.id,
      rank,
      likeCount: row.like_count,
      parts: CATEGORIES.map((c) => ({ category: c, text: row[`${c}_text`] })),
    };
  });
}

export async function loadRanking(db: D1Database, now: number): Promise<Ranking> {
  const { today, week } = periodStarts(now);
  const stmt = db.prepare(RANKING_SQL);
  const [t, w, a] = await db.batch<RankingRow>([stmt.bind(today), stmt.bind(week), stmt.bind(0)]);
  if (!t || !w || !a) throw new Error("ランキングの問い合わせの結果が足りない");
  return { today: toItems(t.results), week: toItems(w.results), all: toItems(a.results) };
}

// ランキングは誰でも見られるので、匿名のIDを使わない
export async function handleRanking(env: Env, now: number): Promise<Response> {
  return json(await loadRanking(env.DB, now));
}
