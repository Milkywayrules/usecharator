import { describe, expect, test } from "bun:test";
import { tierLimit } from "@charator/shared";
import { authenticatedRateLimitForTier } from "./entitlements";
import { clientIpFromHeaders, SlidingWindowRateLimiter } from "./rate-limit";

describe("rate limiter", () => {
  test("allows requests inside the window", () => {
    const limiter = new SlidingWindowRateLimiter(2, 60_000);
    expect(limiter.consume("ip:1", 0).allowed).toBe(true);
    expect(limiter.consume("ip:1", 1000).allowed).toBe(true);
    expect(limiter.consume("ip:1", 2000).allowed).toBe(false);
  });

  test("resets after the window elapses", () => {
    const limiter = new SlidingWindowRateLimiter(1, 1000);
    expect(limiter.consume("ip:2", 0).allowed).toBe(true);
    expect(limiter.consume("ip:2", 500).allowed).toBe(false);
    expect(limiter.consume("ip:2", 1001).allowed).toBe(true);
  });
});

describe("clientIpFromHeaders", () => {
  test("prefers the rightmost x-forwarded-for address", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
    });
    expect(clientIpFromHeaders(headers)).toBe("10.0.0.1");
  });
});

describe("authenticatedRateLimitForTier", () => {
  test("maps each tier to authenticatedGenerationsPerHour", () => {
    expect(authenticatedRateLimitForTier("free")).toBe(
      tierLimit("free", "authenticatedGenerationsPerHour")
    );
    expect(authenticatedRateLimitForTier("plus")).toBe(
      tierLimit("plus", "authenticatedGenerationsPerHour")
    );
    expect(authenticatedRateLimitForTier("pro")).toBe(
      tierLimit("pro", "authenticatedGenerationsPerHour")
    );
    expect(authenticatedRateLimitForTier("studio")).toBe(
      tierLimit("studio", "authenticatedGenerationsPerHour")
    );
  });

  test("uses 600 fallback when tier limit is null", () => {
    expect(authenticatedRateLimitForTier("studio")).toBe(600);
  });
});
