import { SERVER_HTTP } from '../config.js';

export async function createRoom(): Promise<string> {
  // TODO: include auth token / guest cookie when Sprint 4 lands
  const res = await fetch(`${SERVER_HTTP}/room/create`, { method: 'POST' });
  if (!res.ok) throw new Error(`Create failed: ${res.status}`);
  const data = (await res.json()) as { code: string };
  return data.code;
}