import { describe, expect, test } from "bun:test";
import {
  apiTokens,
  characters,
  type Db,
  generationJobs,
  member,
  sheetBatches,
  subscriptions,
  user,
} from "@charator/db";
import {
  isAtOrOverLimit,
  suggestUpgradeTier,
  tierLimit,
} from "@charator/shared";
import {
  countWorkspaceUsage,
  resolveEntitlements,
  throwTierLimitError,
} from "./entitlements";
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

interface UsageCountState {
  generationJobsInMonth: number;
  generationJobsStored: number;
  ownedWorkspaces: number;
}

function createUsageCountDb(state: UsageCountState): Db {
  let generationJobQueryCount = 0;

  const countResult = (count: number) =>
    Promise.resolve([{ count }] as [{ count: number }]);

  const db = {
    select(_fields: unknown) {
      return {
        from(table: unknown) {
          return {
            where() {
              if (table === generationJobs) {
                generationJobQueryCount += 1;
                if (generationJobQueryCount === 1) {
                  return countResult(state.generationJobsInMonth);
                }
                return countResult(state.generationJobsStored);
              }
              if (
                table === characters ||
                table === sheetBatches ||
                table === apiTokens
              ) {
                return countResult(0);
              }
              if (table === member) {
                return countResult(state.ownedWorkspaces);
              }
              return countResult(0);
            },
          };
        },
      };
    },
  };

  return db as unknown as Db;
}

describe("countWorkspaceUsage", () => {
  test("counts all generation jobs in the UTC month", async () => {
    const db = createUsageCountDb({
      generationJobsInMonth: 5,
      generationJobsStored: 3,
      ownedWorkspaces: 1,
    });

    const usage = await countWorkspaceUsage(db, "ws-1", "owner-1", "2026-07");

    expect(usage.generationsThisMonth).toBe(5);
    expect(usage.storedGenerations).toBe(3);
  });

  test("returns zero generationsThisMonth when no jobs exist in month", async () => {
    const db = createUsageCountDb({
      generationJobsInMonth: 0,
      generationJobsStored: 0,
      ownedWorkspaces: 1,
    });

    const usage = await countWorkspaceUsage(db, "ws-1", "owner-1", "2026-07");

    expect(usage.generationsThisMonth).toBe(0);
  });
});
