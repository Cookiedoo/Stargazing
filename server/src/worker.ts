import { generateRoomCode, isValidCodeFormat } from "@stargazing/shared";
import { GameRoom } from "./rooms/GameRoom.js";
import type { Env } from "./types.js";

export { GameRoom };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // TODO: lock down to your client domain in prod
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // POST /room/create -> generate a code, init the DO, return the code
    if (url.pathname === "/room/create" && request.method === "POST") {
      // TODO Sprint 1.1: collision check loop (try a few codes if the first exists).
      //   For now, with our small wordlist, just generate one.
      const code = generateRoomCode();

      // idFromName gives us a STABLE id derived from the code string.
      // Same code = same DO. This is how clients route to the right room.
      const id = env.GAME_ROOMS.idFromName(code);
      const stub = env.GAME_ROOMS.get(id);

      // Tell the DO it was just created (it can store the code, set match phase, etc.)
      await stub.fetch("https://room/init", {
        method: "POST",
        body: JSON.stringify({ code }),
      });

      return Response.json({ code }, { headers: CORS_HEADERS });
    }

    // GET /room/:code/join -> upgrade to WebSocket, hand off to the DO
    const joinMatch = url.pathname.match(/^\/room\/([a-z-]+)\/join$/);
    if (joinMatch && request.method === "GET") {
      const code = joinMatch[1];

      if (!isValidCodeFormat(code)) {
        return new Response("Bad code format", {
          status: 400,
          headers: CORS_HEADERS,
        });
      }

      // Upgrade header check — WebSockets only on this route.
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket upgrade", {
          status: 426,
          headers: CORS_HEADERS,
        });
      }

      const id = env.GAME_ROOMS.idFromName(code);
      const stub = env.GAME_ROOMS.get(id);

      // Forward the original request to the DO. CF preserves the upgrade.
      return stub.fetch(request);
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
};
