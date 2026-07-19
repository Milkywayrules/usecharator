import { describe, expect, test } from "bun:test";
import {
  currentUtcPeriod,
  isAtOrOverLimit,
  LIMIT_KEYS,
  suggestUpgradeTier,
  TIER_IDS,
  TIER_LIMITS,
  tierLimit,
  utcPeriodForDate,
} from "./tiers";

describe("tier limits registry", () => {
  test("every tier defines every limit key", () => {
    for (const tier of TIER_IDS) {
      for (const key of LIMIT_KEYS) {
        expect(TIER_LIMITS[tier][key]).toBeDefined();
      }
    }
  });
});

describe("utc period derivation", () => {
  test("uses UTC calendar month boundaries", () => {
    expect(utcPeriodForDate(new Date("2026-06-30T23:59:59.999Z"))).toBe(
      "2026-06"
    );
    expect(utcPeriodForDate(new Date("2026-07-01T00:00:00.000Z"))).toBe(
      "2026-07"
    );
    expect(currentUtcPeriod(new Date("2026-07-15T12:00:00.000Z"))).toBe(
      "2026-07"
    );
  });
});

describe("limit helpers", () => {
  test("null limit is never at cap", () => {
    expect(isAtOrOverLimit(999_999, null)).toBe(false);
  });

  test("at-limit blocks new creation", () => {
    expect(isAtOrOverLimit(15, 15)).toBe(true);
    expect(isAtOrOverLimit(14, 15)).toBe(false);
  });

  test("suggestUpgradeTier skips inadequate tiers", () => {
    expect(suggestUpgradeTier("free", "charactersPerWorkspace", 15)).toBe(
      "plus"
    );
    expect(tierLimit("studio", "workspaces")).toBeNull();
  });
});
