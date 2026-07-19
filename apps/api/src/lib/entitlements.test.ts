import { describe, expect, test } from "bun:test";
import {
  isAtOrOverLimit,
  suggestUpgradeTier,
  tierLimit,
} from "@charator/shared";
import { throwTierLimitError } from "./entitlements";
import { HttpError } from "./errors";

describe("entitlement checker logic", () => {
  test("at limit throws 402 tier_limit shape", () => {
    expect(() =>
      throwTierLimitError({
        current: 15,
        limitKey: "charactersPerWorkspace",
        tier: "free",
      })
    ).toThrow(HttpError);

    try {
      throwTierLimitError({
        current: 15,
        limitKey: "charactersPerWorkspace",
        tier: "free",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      const httpError = error as HttpError;
      expect(httpError.status).toBe(402);
      expect(httpError.body.code).toBe("tier_limit");
      if (httpError.body.code === "tier_limit") {
        expect(httpError.body.current).toBe(15);
        expect(httpError.body.limit).toBe("charactersPerWorkspace");
        expect(httpError.body.tier).toBe("free");
        expect(httpError.body.upgradeTier).toBe("plus");
      }
    }
  });

  test("unlimited studio workspace cap never blocks via isAtOrOverLimit", () => {
    expect(isAtOrOverLimit(10_000, tierLimit("studio", "workspaces"))).toBe(
      false
    );
  });

  test("downgrade preserves data — only new creation blocked at cap", () => {
    expect(
      isAtOrOverLimit(20, tierLimit("free", "charactersPerWorkspace"))
    ).toBe(true);
    expect(
      isAtOrOverLimit(20, tierLimit("pro", "charactersPerWorkspace"))
    ).toBe(false);
  });

  test("suggestUpgradeTier returns null when no tier helps", () => {
    expect(
      suggestUpgradeTier("studio", "apiTokensPerWorkspace", 50)
    ).toBeNull();
  });
});
