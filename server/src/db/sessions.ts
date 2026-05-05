import type { Sql } from "./client.js";

export interface Session {
  token: string;
  accountId: string;
  expiresAt: Date;
}

const SESSION_TTL_DAYS = 30;

export async function createSession(sql: Sql, accountId: string): Promise<Session> {
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

  const rows = await sql`
    INSERT INTO sessions (token, account_id, expires_at)
    VALUES (
      ${token},
      ${accountId},
      NOW() + ${SESSION_TTL_DAYS} * INTERVAL '1 day'
    )
    RETURNING *
  `;

  if (rows.length === 0) {
    throw new Error("Failed to create session");
  }
  return rowToSession(rows[0]);
}

export async function findValidSession(sql: Sql, token: string): Promise<Session | null> {
  const rows = await sql`
    SELECT * FROM sessions
    WHERE token = ${token} AND expires_at > NOW()
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  await sql`
    UPDATE sessions SET last_used_at = NOW() WHERE token = ${token}
  `;

  return rowToSession(rows[0]);
}

export async function deleteSession(sql: Sql, token: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

export async function deleteExpiredSessions(sql: Sql): Promise<number> {
  const rows = await sql`
    DELETE FROM sessions WHERE expires_at < NOW() RETURNING token
  `;
  return rows.length;
}

function rowToSession(row: Record<string, unknown>): Session {
  return {
    token: row.token as string,
    accountId: row.account_id as string,
    expiresAt: row.expires_at as Date,
  };
}