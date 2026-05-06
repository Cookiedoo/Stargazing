import { WORDS } from "./wordlist.js";

export function generateRoomCode(rng: () => number = Math.random): string {
  const pick = () => WORDS[Math.floor(rng() * WORDS.length)];
  return `${pick()}-${pick()}-${pick()}`;
}

const CODE_RE = /^[a-z]+-[a-z]+-[a-z]+$/;
export function isValidCodeFormat(code: string): boolean {
  return CODE_RE.test(code) && code.length <= 30;
}

export function normalizeRoomCode(input: string): string | null {
  const tokens = input
    .toLowerCase()
    .split(/[^a-z]+/) 
    .filter(Boolean);

  if (tokens.length !== 3) return null;
  return tokens.join("-");
}
