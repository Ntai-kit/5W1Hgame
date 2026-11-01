import { loadConfig, type Config } from "./config";
import { handleDraw, handleLike, handleReport } from "./gacha";
import { assertSameOrigin, errorResponse } from "./http";
import { getOrCreatePlayer, type Player } from "./player";
import { handleRanking } from "./ranking";

const API_PREFIX = "/games/5w1h/api/";

type Handler = (req: Request, env: Env, player: Player, cfg: Config, now: number) => Promise<Response>;
type PublicHandler = (req: Request, env: Env, cfg: Config, now: number) => Promise<Response>;

// 誰でも見られる API。匿名のIDを作らずに返す
const PUBLIC_ROUTES: Record<string, PublicHandler> = {
  "GET ranking": (_req, env, _cfg, now) => handleRanking(env, now),
};

const ROUTES: Record<string, Handler> = {
  "GET gacha": (_req, env, player, cfg, now) => handleDraw(env, player, cfg, now),
  "POST likes": handleLike,
  "POST reports": handleReport,
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith(API_PREFIX)) return errorResponse(404);
    const routeKey = `${req.method} ${url.pathname.slice(API_PREFIX.length)}`;
    const publicHandler = PUBLIC_ROUTES[routeKey];
    // 知らないパスは、プレイヤーの行を作る前に断る
    const handler = ROUTES[routeKey];
    if (!publicHandler && !handler) return errorResponse(404);

    try {
      const cfg = loadConfig(env);
      if (req.method !== "GET") {
        const denied = assertSameOrigin(req, cfg);
        if (denied) return denied;
      }
      const now = Date.now();
      if (publicHandler) return await publicHandler(req, env, cfg, now);
      if (!handler) return errorResponse(404);
      const { player, setCookie } = await getOrCreatePlayer(req, env.DB, now);
      const res = await handler(req, env, player, cfg, now);
      if (setCookie) res.headers.append("Set-Cookie", setCookie);
      return res;
    } catch (err) {
      return errorResponse(500, err);
    }
  },
} satisfies ExportedHandler<Env>;
