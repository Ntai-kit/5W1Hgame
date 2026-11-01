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
