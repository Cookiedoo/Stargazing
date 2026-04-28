import type { DurableObjectNamespace } from '@cloudflare/workers-types';

export interface Env {
  GAME_ROOMS: DurableObjectNamespace;
  // TODO Sprint 4: HYPERDRIVE binding for Postgres
  // TODO Sprint 4: AUTH_SECRET (env var)
}