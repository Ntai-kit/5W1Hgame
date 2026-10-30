export type Player = { id: string; bannedAt: number | null };

const COOKIE_NAME = "pid";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// 1年。Cookie が切れると新しいIDになるだけなので、長めにする
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

function readPid(req: Request): string | null {
  const header = req.headers.get("Cookie");
  if (!header) return null;
  for (const pair of header.split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name === COOKIE_NAME) {
      const value = rest.join("=");
      return UUID_PATTERN.test(value) ? value : null;
    }
  }
  return null;
}

// Cookie のIDが players にあればその人、なければ新しいIDを作る
export async function getOrCreatePlayer(
  req: Request,
  db: D1Database,
  now: number,
): Promise<{ player: Player; setCookie: string | null }> {
  const pid = readPid(req);
  if (pid) {
    const row = await db.prepare("SELECT id, banned_at FROM players WHERE id = ?").bind(pid).first<{ id: string; banned_at: number | null }>();
    if (row) return { player: { id: row.id, bannedAt: row.banned_at }, setCookie: null };
  }
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO players (id, created_at) VALUES (?, ?)").bind(id, now).run();
  const setCookie = `${COOKIE_NAME}=${id}; HttpOnly; Secure; SameSite=Lax; Path=/games/5w1h; Max-Age=${COOKIE_MAX_AGE_SEC}`;
  return { player: { id, bannedAt: null }, setCookie };
}
