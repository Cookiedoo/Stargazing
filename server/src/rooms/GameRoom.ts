import { MSG, PROTOCOL_VERSION } from "@stargazing/shared";
import type { ClientMessage, ServerMessage } from "@stargazing/shared";
import type { DurableObjectState } from "@cloudflare/workers-types";
import type { Env } from "../types.js";
import { Simulation, TICK_DT } from "../sim/Simulation.js";

interface PlayerConnection {
  id: string;
  socket: WebSocket;
}

const SNAPSHOT_RATE_HZ = 20;
const TICKS_PER_SNAPSHOT = Math.round(1 / SNAPSHOT_RATE_HZ / TICK_DT);

export class GameRoom {
  private state: DurableObjectState;
  private code: string = "";
  private players = new Map<string, PlayerConnection>();
  private sim = new Simulation();

  // We use setInterval for the tick. In Workers this works inside a DO
  // for as long as the DO is alive. When all players leave we'll clear it.
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private ticksSinceSnapshot = 0;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<string>("code");
      if (stored) this.code = stored;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/init" && request.method === "POST") {
      const body = await request.json<{ code: string }>();
      this.code = body.code;
      await this.state.storage.put("code", body.code);
      return new Response("ok");
    }

    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleJoin(request);
    }

    return new Response("Not found", { status: 404 });
  }

  private handleJoin(_request: Request): Response {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();

    const playerId = crypto.randomUUID().slice(0, 8);
    this.players.set(playerId, { id: playerId, socket: server });
    this.sim.addPlayer(playerId);

    this.send(server, {
      type: MSG.WELCOME,
      payload: {
        yourId: playerId,
        roomCode: this.code,
        players: [...this.players.keys()],
      },
    });

    this.broadcast(
      { type: MSG.PLAYER_JOINED, payload: { id: playerId } },
      playerId,
    );

    server.addEventListener("message", (event) => {
      this.onMessage(playerId, event.data);
    });

    server.addEventListener("close", () => {
      this.players.delete(playerId);
      this.sim.removePlayer(playerId);
      this.broadcast({ type: MSG.PLAYER_LEFT, payload: { id: playerId } });
      if (this.players.size === 0) this.stopTick();
    });

    server.addEventListener("error", () => {
      this.players.delete(playerId);
      this.sim.removePlayer(playerId);
      if (this.players.size === 0) this.stopTick();
    });

    // Start the tick loop on first join.
    this.startTick();

    return new Response(null, { status: 101, webSocket: client });
  }

  private startTick(): void {
    if (this.tickInterval !== null) return;
    this.tickInterval = setInterval(() => {
      this.sim.step();
      this.ticksSinceSnapshot++;
      if (this.ticksSinceSnapshot >= TICKS_PER_SNAPSHOT) {
        this.ticksSinceSnapshot = 0;
        this.broadcastSnapshot();
      }
    }, TICK_DT * 1000);
  }

  private stopTick(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private broadcastSnapshot(): void {
    const snap = this.sim.buildSnapshot();
    this.broadcast({
      type: MSG.SNAPSHOT,
      payload: snap,
    });
  }

  private onMessage(fromId: string, raw: ArrayBuffer | string): void {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(
        typeof raw === "string" ? raw : new TextDecoder().decode(raw),
      );
    } catch {
      return;
    }

    switch (msg.type) {
      case MSG.HELLO:
        this.broadcast({
          type: MSG.HELLO,
          payload: { text: msg.payload.text, from: fromId },
        });
        break;
      case MSG.INPUT:
        this.sim.receiveInput(
          fromId,
          { thrust: msg.payload.thrust, strafe: msg.payload.strafe },
          msg.payload.clientTick, // NEW
        );
        break;
      default:
        break;
    }
  }

  private send(socket: WebSocket, msg: ServerMessage): void {
    socket.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage, exceptId?: string): void {
    const data = JSON.stringify(msg);
    for (const [id, conn] of this.players) {
      if (id === exceptId) continue;
      try {
        conn.socket.send(data);
      } catch {
        // dead conn; cleanup happens via close event
      }
    }
  }
}

void PROTOCOL_VERSION;
