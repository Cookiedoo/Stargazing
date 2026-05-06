import { SERVER_HTTP } from '../config.js';

export interface ApiAccount {
  id: string;
  username: string | null;
  isGuest: boolean;
}

export interface AuthResponse {
  account: ApiAccount;
}

export interface ApiError {
  error: string;
}

async function postJson(path: string, body?: unknown): Promise<Response> {
  return fetch(`${SERVER_HTTP}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function authGuest(): Promise<AuthResponse> {
  const r = await postJson('/auth/guest');
  if (!r.ok) throw new Error(`auth/guest failed: ${r.status}`);
  return r.json();
}

export async function authRegister(username: string, password: string): Promise<AuthResponse> {
  const r = await postJson('/auth/register', { username, password });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as ApiError;
    throw new Error(data.error ?? `register failed: ${r.status}`);
  }
  return r.json();
}

export async function authLogin(username: string, password: string): Promise<AuthResponse> {
  const r = await postJson('/auth/login', { username, password });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as ApiError;
    throw new Error(data.error ?? `login failed: ${r.status}`);
  }
  return r.json();
}

export async function authLogout(): Promise<void> {
  await postJson('/auth/logout');
}