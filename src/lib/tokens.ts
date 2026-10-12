import { randomBytes } from "crypto";

// Crockford base32: no I, L, O or U, so tokens are easy to read out and type at a desk.
const TOKEN_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TOKEN_CHARS = 20; // 20 × 5 bits = 100 bits of randomness

/** Unguessable QR token, e.g. "7KQ2M-XB9RT-4HNCV-8EWPA". */
export function newQrToken(): string {
  const bytes = randomBytes(TOKEN_CHARS);
  let raw = "";
  for (const b of bytes) raw += TOKEN_ALPHABET[b & 31]; // 256 is a multiple of 32, so no bias
  return raw.match(/.{5}/g)!.join("-");
}

/**
 * Canonical form of a token someone typed: case-insensitive, ignores spaces and
 * dashes, and treats O as 0 and I/L as 1. Anything else is returned trimmed.
 */
export function normalizeQrToken(input: string): string {
  const trimmed = input.trim();
  const raw = trimmed.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (raw.length === TOKEN_CHARS && /^[0-9A-HJKMNP-TV-Z]+$/.test(raw)) return raw.match(/.{5}/g)!.join("-");
  return trimmed;
}

const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no look-alike characters

/** Short random slug for public links, e.g. "town-hall-x7k2m9pq". */
export function newSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
  const bytes = randomBytes(8);
  let suffix = "";
  for (const b of bytes) suffix += SLUG_ALPHABET[b % SLUG_ALPHABET.length];
  return base ? `${base}-${suffix}` : suffix;
}
