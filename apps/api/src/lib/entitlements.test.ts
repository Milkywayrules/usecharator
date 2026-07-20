import { describe, expect, test } from "bun:test";
import { type Db, subscriptions, user } from "@charator/db";
import {
  isAtOrOverLimit,
  suggestUpgradeTier,
  tierLimit,
} from "@charator/shared";
import { resolveEntitlements, throwTierLimitError } from "./entitlements";
import { HttpError } from "./errors";

interface LazyDowngradeState {
  subscription: {
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date;
    status: string;
  } | null;
  userTier: string;
}

function createLazyDowngradeDb(state: LazyDowngradeState): Db {
  const db = {
    select(_fields: unknown) {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit() {
                  if (table === user) {
                    return Promise.resolve([{ tier: state.userTier }]);
                  }
                  if (table === subscriptions && state.subscription) {
                    return Promise.resolve([state.subscription]);
                  }
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: { tier?: string }) {
          return {
            where() {
              if (table === user && values.tier !== undefined) {
                state.userTier = values.tier;
              }
              return Promise.resolve();
            },
          };
        },
      };
    },
  };

  return db as unknown as Db;
}

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

  test("lazy downgrade applies after canceled period ends", async () => {
    const state: LazyDowngradeState = {
      subscription: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(Date.now() - 60_000),
        status: "canceled",
      },
      userTier: "plus",
    };
    const db = createLazyDowngradeDb(state);
    const resolved = await resolveEntitlements(db, "user-1");
    expect(resolved.tier).toBe("free");
    expect(state.userTier).toBe("free");
  });

  test("lazy downgrade keeps paid tier before period ends", async () => {
    const state: LazyDowngradeState = {
      subscription: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
        status: "canceled",
      },
      userTier: "plus",
    };
    const db = createLazyDowngradeDb(state);
    const resolved = await resolveEntitlements(db, "user-1");
    expect(resolved.tier).toBe("plus");
    expect(state.userTier).toBe("plus");
  });
});
