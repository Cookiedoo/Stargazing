import type { Sql } from "../db/client.js";
import { findValidSession, type Session } from "../db/sessions.js";
import { findAccountById, type Account } from "../db/accounts.js";

export const SESSION_COOKIE_NAME = "stargazing_session";

export interface AuthContext {
  account: Account;
  session: Session;
}

export function readSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === SESSION_COOKIE_NAME) return v;
  }
  return null;
}

export function buildSessionCookie(token: string, expiresAt: Date): string {
  const expiry = expiresAt.toUTCString();
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    `Path=/`,
    `Expires=${expiry}`,
    `HttpOnly`,
    `Secure`,
    `SameSite=None`,
  ].join("; ");
}

export async function requireAuth(
  sql: Sql,
  request: Request,
): Promise<AuthContext | null> {
  const token = readSessionCookie(request);
  if (!token) return null;
  const session = await findValidSession(sql, token);
  if (!session) return null;
  const account = await findAccountById(sql, session.accountId);
  if (!account) return null;
  return { account, session };
}