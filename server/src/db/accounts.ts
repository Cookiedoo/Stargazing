import type { Sql } from "./client.js";

export interface Account {
  id: string;
  username: string | null;
  passwordHash: string | null;
  isGuest: boolean;
  createdAt: Date;
  lastSeenAt: Date;
}

export async function createGuestAccount(sql: Sql): Promise<Account> {
  const rows = await sql`
    INSERT INTO accounts (is_guest)
    VALUES (true)
    RETURNING *
  `;
  if (rows.length === 0) {
    throw new Error("Failed to create guest account");
  }
  return rowToAccount(rows[0]);
}

export async function findAccountByUsername(
  sql: Sql,
  username: string,
): Promise<Account | null> {
  const rows = await sql`
    SELECT * FROM accounts WHERE username = ${username} LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToAccount(rows[0]);
}

export async function findAccountById(
  sql: Sql,
  id: string,
): Promise<Account | null> {
  const rows = await sql`
    SELECT * FROM accounts WHERE id = ${id} LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToAccount(rows[0]);
}

export async function registerAccount(
  sql: Sql,
  guestId: string,
  username: string,
  passwordHash: string,
): Promise<Account> {
  const rows = await sql`
    UPDATE accounts
    SET username = ${username},
        password_hash = ${passwordHash},
        is_guest = false
    WHERE id = ${guestId}
    RETURNING *
  `;
  if (rows.length === 0) {
    throw new Error("Failed to register account: guest not found");
  }
  return rowToAccount(rows[0]);
}

export async function touchLastSeen(sql: Sql, id: string): Promise<void> {
  await sql`
    UPDATE accounts
    SET last_seen_at = NOW()
    WHERE id = ${id}
  `;
}

function rowToAccount(row: Record<string, unknown>): Account {
  return {
    id: row.id as string,
    username: row.username as string | null,
    passwordHash: row.password_hash as string | null,
    isGuest: row.is_guest as boolean,
    createdAt: row.created_at as Date,
    lastSeenAt: row.last_seen_at as Date,
  };
}