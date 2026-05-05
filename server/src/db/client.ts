import postgres from 'postgres';
import type { Env } from '../types.js';

export type Sql = postgres.Sql;

export function getDb(env: Env): Sql {
  return postgres(env.DB.connectionString, {
    max: 5,
    fetch_types: false,
    prepare: false,
  });
}