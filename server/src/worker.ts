import { generateRoomCode, isValidCodeFormat } from "@stargazing/shared";
import { GameRoom } from "./rooms/GameRoom.js";
import type { Env } from "./types.js";
import {
  handleAuthGuest,
  handleAuthRegister,
  handleAuthLogin,
  handleAuthLogout,
} from "./auth/routes.js";

export { GameRoom };

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    if (url.pathname === "/auth/guest" && request.method === "POST") {
      return handleAuthGuest(request, env);
    }
    if (url.pathname === "/auth/register" && request.method === "POST") {
      return handleAuthRegister(request, env);
    }
    if (url.pathname === "/auth/login" && request.method === "POST") {
      return handleAuthLogin(request, env);
    }
    if (url.pathname === "/auth/logout" && request.method === "POST") {
      return handleAuthLogout(request, env);
    }

    if (url.pathname === "/room/create" && request.method === "POST") {
      const code = generateRoomCode();
      const id = env.GAME_ROOMS.idFromName(code);
      const stub = env.GAME_ROOMS.get(id);
      await stub.fetch("https://room/init", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      return Response.json({ code }, { headers: corsHeaders(request) });
    }

    const joinMatch = url.pathname.match(/^\/room\/([a-z-]+)\/join$/);
    if (joinMatch && request.method === "GET") {
      const code = joinMatch[1];
      if (!isValidCodeFormat(code)) {
        return new Response("Bad code format", { status: 400, headers: corsHeaders(request) });
      }
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426, headers: corsHeaders(request) });
      }
      const id = env.GAME_ROOMS.idFromName(code);
      const stub = env.GAME_ROOMS.get(id);
      return stub.fetch(request);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(request) });
  },
};