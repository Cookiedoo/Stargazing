import type { Hyperdrive } from "@cloudflare/workers-types";

export interface Env {
  GAME_ROOMS: DurableObjectNamespace;
  DB: Hyperdrive;
}
