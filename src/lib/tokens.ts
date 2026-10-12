import { randomBytes } from "crypto";

/** Unguessable QR token: 128 bits of randomness, URL-safe. */
export function newQrToken(): string {
  return randomBytes(16).toString("base64url");
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
