import type { Config } from "./config";

const COMMON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const res = new Response(JSON.stringify(data), { status, headers: COMMON_HEADERS });
  if (headers) new Headers(headers).forEach((value, key) => res.headers.set(key, value));
  return res;
}

// 利用者には番号だけを返し、詳しい内容はログに残す。ログに個人を見分ける値は書かない
export function errorResponse(status: number, err?: unknown): Response {
  const requestId = crypto.randomUUID();
  if (err !== undefined) console.error(JSON.stringify({ requestId, error: err instanceof Error ? err.stack ?? err.message : String(err) }));
  return json({ error: "うまくいきませんでした", requestId }, status);
}

export function limitedResponse(retryAfterSec: number): Response {
  return json({ error: "回数の上限です", retryAfterSec }, 429, { "Retry-After": String(retryAfterSec) });
}

export function assertSameOrigin(req: Request, cfg: Config): Response | null {
  return req.headers.get("Origin") === cfg.allowedOrigin ? null : errorResponse(403);
}
