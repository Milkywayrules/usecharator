import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const API_TOKEN_LIVE_PREFIX = "ct_live_";
const RANDOM_TOKEN_BYTES = 32;
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BEARER_HEADER_PATTERN = /^Bearer\s+(\S+)\s*$/i;

function randomBase62(length: number): string {
  const bytes = randomBytes(length);
  let output = "";
  for (let index = 0; index < length; index += 1) {
    const byte = bytes[index] ?? 0;
    output += BASE62[byte % BASE62.length];
  }
  return output;
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function deriveTokenPrefix(token: string): string {
  return token.slice(0, API_TOKEN_LIVE_PREFIX.length + 8);
}

export function isValidApiTokenFormat(token: string): boolean {
  if (!token.startsWith(API_TOKEN_LIVE_PREFIX)) {
    return false;
  }
  const secret = token.slice(API_TOKEN_LIVE_PREFIX.length);
  return secret.length >= RANDOM_TOKEN_BYTES;
}

export function parseBearerToken(
  authorizationHeader: string | null
): string | null {
  if (!authorizationHeader) {
    return null;
  }
  const match = authorizationHeader.match(BEARER_HEADER_PATTERN);
  if (!match?.[1]) {
    return null;
  }
  return match[1];
}

export function generateApiTokenSecret(): {
  prefix: string;
  token: string;
  tokenHash: string;
} {
  const secret = randomBase62(RANDOM_TOKEN_BYTES);
  const token = `${API_TOKEN_LIVE_PREFIX}${secret}`;
  return {
    prefix: deriveTokenPrefix(token),
    token,
    tokenHash: hashApiToken(token),
  };
}

export function verifyApiTokenHash(token: string, tokenHash: string): boolean {
  if (!isValidApiTokenFormat(token)) {
    return false;
  }
  const expected = hashApiToken(token);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const tokenHashBuffer = Buffer.from(tokenHash, "utf8");
  if (expectedBuffer.length !== tokenHashBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, tokenHashBuffer);
}
