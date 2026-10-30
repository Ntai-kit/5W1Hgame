import { loadConfig } from "./config";
import { assertSameOrigin, errorResponse, json } from "./http";
import { getOrCreatePlayer } from "./player";

const API_PREFIX = "/games/5w1h/api/";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith(API_PREFIX)) return errorResponse(404);
    const path = url.pathname.slice(API_PREFIX.length);

    try {
      const cfg = loadConfig(env);
      if (req.method !== "GET") {
        const denied = assertSameOrigin(req, cfg);
        if (denied) return denied;
      }
      const now = Date.now();
      const { setCookie } = await getOrCreatePlayer(req, env.DB, now);

      let res: Response;
      if (req.method === "GET" && path === "ping") res = json({ ok: true });
      else res = errorResponse(404);

      if (setCookie) res.headers.append("Set-Cookie", setCookie);
      return res;
    } catch (err) {
      return errorResponse(500, err);
    }
  },
} satisfies ExportedHandler<Env>;
