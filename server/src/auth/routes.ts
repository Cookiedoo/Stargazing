import type { Env } from "../types.js";
import { getDb } from "../db/client.js";
import {
  createGuestAccount,
  findAccountByUsername,
  registerAccount,
} from "../db/accounts.js";
import { createSession, deleteSession } from "../db/sessions.js";
import { hashPassword, verifyPassword } from "./password.js";
import { buildSessionCookie, requireAuth } from "./sessions.js";

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

function jsonResponse(
  request: Request,
  data: unknown,
  init: { status?: number; cookie?: string } = {},
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...corsHeaders(request),
  };
  if (init.cookie) headers["Set-Cookie"] = init.cookie;
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers,
  });
}

function errorResponse(request: Request, status: number, message: string): Response {
  return jsonResponse(request, { error: message }, { status });
}

export async function handleAuthGuest(request: Request, env: Env): Promise<Response> {
  const sql = getDb(env);
  try {
    const existing = await requireAuth(sql, request);
    if (existing) {
      return jsonResponse(request, { account: existing.account });
    }

    const account = await createGuestAccount(sql);
    const session = await createSession(sql, account.id);
    const cookie = buildSessionCookie(session.token, session.expiresAt);
    return jsonResponse(request, { account }, { cookie });
  } catch (err) {
    console.error("handleAuthGuest:", err);
    return errorResponse(request, 500, "internal error");
  } finally {
    await sql.end();
  }
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export async function handleAuthRegister(request: Request, env: Env): Promise<Response> {
  const sql = getDb(env);
  try {
    let body: { username?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return errorResponse(request, 400, "invalid JSON");
    }

    const username = (body.username ?? "").trim();
    const password = body.password ?? "";

    if (!USERNAME_RE.test(username)) {
      return errorResponse(request, 400, "username must be 3-20 chars, alphanumeric + underscore");
    }
    if (password.length < 8) {
      return errorResponse(request, 400, "password must be at least 8 characters");
    }

    const auth = await requireAuth(sql, request);
    if (!auth) {
      return errorResponse(request, 401, "no active session — call /auth/guest first");
    }
    if (!auth.account.isGuest) {
      return errorResponse(request, 409, "account is already registered");
    }

    const taken = await findAccountByUsername(sql, username);
    if (taken) {
      return errorResponse(request, 409, "username taken");
    }

    const passwordHash = await hashPassword(password);
    const account = await registerAccount(sql, auth.account.id, username, passwordHash);
    return jsonResponse(request, { account });
  } catch (err) {
    console.error("handleAuthRegister:", err);
    return errorResponse(request, 500, "internal error");
  } finally {
    await sql.end();
  }
}

export async function handleAuthLogin(request: Request, env: Env): Promise<Response> {
  const sql = getDb(env);
  try {
    let body: { username?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return errorResponse(request, 400, "invalid JSON");
    }

    const username = (body.username ?? "").trim();
    const password = body.password ?? "";

    if (!username || !password) {
      return errorResponse(request, 400, "username and password required");
    }

    const account = await findAccountByUsername(sql, username);
    if (!account || !account.passwordHash) {
      return errorResponse(request, 401, "invalid credentials");
    }

    const ok = await verifyPassword(password, account.passwordHash);
    if (!ok) {
      return errorResponse(request, 401, "invalid credentials");
    }

    const existing = await requireAuth(sql, request);
    if (existing) {
      await deleteSession(sql, existing.session.token);
    }

    const session = await createSession(sql, account.id);
    const cookie = buildSessionCookie(session.token, session.expiresAt);
    return jsonResponse(request, { account }, { cookie });
  } catch (err) {
    console.error("handleAuthLogin:", err);
    return errorResponse(request, 500, "internal error");
  } finally {
    await sql.end();
  }
}

export async function handleAuthLogout(request: Request, env: Env): Promise<Response> {
  const sql = getDb(env);
  try {
    const auth = await requireAuth(sql, request);
    if (auth) {
      await deleteSession(sql, auth.session.token);
    }
    const expiredCookie = buildSessionCookie("", new Date(0));
    return jsonResponse(request, { ok: true }, { cookie: expiredCookie });
  } catch (err) {
    console.error("handleAuthLogout:", err);
    return errorResponse(request, 500, "internal error");
  } finally {
    await sql.end();
  }
}