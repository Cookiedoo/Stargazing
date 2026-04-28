import { WORDS } from './wordlist.js';

// 3-word codes give us WORDS^3 possibilities. With ~100 words = 1M;
// with full EFF list = 470B. Server still checks for collisions on insert.
export function generateRoomCode(rng: () => number = Math.random): string {
  const pick = () => WORDS[Math.floor(rng() * WORDS.length)];
  return `${pick()}-${pick()}-${pick()}`;
}

// Validate format only — server still checks if the room exists.
const CODE_RE = /^[a-z]+-[a-z]+-[a-z]+$/;
export function isValidCodeFormat(code: string): boolean {
  return CODE_RE.test(code) && code.length <= 30;
}

export function normalizeRoomCode(input: string): string | null {
  const tokens = input
    .toLowerCase()
    .split(/[^a-z]+/)   // split on anything that isn't a letter
    .filter(Boolean);   // drop empty strings from leading/trailing separators

  if (tokens.length !== 3) return null;
  return tokens.join('-');
}