import { exports } from "cloudflare:workers";

export const BASE = "https://ntaaaaaaaaai.com/games/5w1h";
export const ORIGIN = "https://ntaaaaaaaaai.com";

// Cookie を覚えて次の要求に付ける、テスト用の呼び出し口
export function createClient() {
  let cookie: string | null = null;

  async function send(path: string, init: RequestInit): Promise<Response> {
    const headers = new Headers(init.headers);
    if (cookie) headers.set("Cookie", cookie);
    const res = await exports.default.fetch(new Request(BASE + path, { ...init, headers }));
    const setCookie = res.headers.get("Set-Cookie");
    if (setCookie) cookie = setCookie.split(";")[0] ?? null;
    return res;
  }

  return {
    get: (path: string) => send(path, { method: "GET" }),
    post: (path: string, body: unknown, origin: string | null = ORIGIN) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (origin !== null) headers.Origin = origin;
      return send(path, { method: "POST", headers, body: JSON.stringify(body) });
    },
    postRaw: (path: string, body: string) =>
      send(path, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN }, body }),
    setCookie: (value: string | null) => {
      cookie = value;
    },
    get cookie() {
      return cookie;
    },
  };
}
