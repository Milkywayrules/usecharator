import { describe, expect, test } from "bun:test";
import {
  API_TOKEN_LIVE_PREFIX,
  deriveTokenPrefix,
  generateApiTokenSecret,
  hashApiToken,
  isValidApiTokenFormat,
  parseBearerToken,
  verifyApiTokenHash,
} from "./api-token";

describe("api-token", () => {
  test("hashes tokens deterministically", () => {
    const token = `${API_TOKEN_LIVE_PREFIX}abc1234567890abcdefghijklmnop`;
    expect(hashApiToken(token)).toBe(hashApiToken(token));
    expect(hashApiToken(token)).toHaveLength(64);
  });

  test("derives display prefix from token", () => {
    const token = `${API_TOKEN_LIVE_PREFIX}abc12345zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz`;
    expect(deriveTokenPrefix(token)).toBe(`${API_TOKEN_LIVE_PREFIX}abc12345`);
  });

  test("generates ct_live tokens with hash and prefix", () => {
    const created = generateApiTokenSecret();
    expect(created.token.startsWith(API_TOKEN_LIVE_PREFIX)).toBe(true);
    expect(isValidApiTokenFormat(created.token)).toBe(true);
    expect(created.prefix).toBe(deriveTokenPrefix(created.token));
    expect(verifyApiTokenHash(created.token, created.tokenHash)).toBe(true);
  });

  test("verify rejects malformed or unknown tokens", () => {
    const created = generateApiTokenSecret();
    expect(verifyApiTokenHash("ct_live_short", created.tokenHash)).toBe(false);
    expect(
      verifyApiTokenHash(created.token, hashApiToken("ct_live_unknown"))
    ).toBe(false);
    expect(isValidApiTokenFormat("Bearer ct_live_oops")).toBe(false);
  });

  test("parseBearerToken accepts valid bearer headers", () => {
    const token = `${API_TOKEN_LIVE_PREFIX}abc1234567890abcdefghijklmnop`;
    expect(parseBearerToken(`Bearer ${token}`)).toBe(token);
    expect(parseBearerToken("bearer ct_live_bad")).toBe("ct_live_bad");
  });

  test("parseBearerToken rejects malformed authorization headers", () => {
    expect(parseBearerToken(null)).toBeNull();
    expect(parseBearerToken("Token abc")).toBeNull();
    expect(parseBearerToken("Bearer")).toBeNull();
    expect(parseBearerToken("Bearer two tokens")).toBeNull();
  });
});
