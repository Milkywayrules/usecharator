import { describe, expect, test } from "bun:test";
import { type Db, subscriptions, user } from "@charator/db";
import { applyBillingWebhookEvent } from "./apply-webhook";
import type { WebhookEvent } from "./types";

interface SubscriptionRow {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date;
  id: string;
  status: string;
  tier: string;
  userId: string;
}

interface TestBillingState {
  subscription: SubscriptionRow | null;
  userTier: string;
}

function createTestDb(state: TestBillingState): Db {
  const db = {
    insert(table: unknown) {
      if (table !== subscriptions) {
        throw new Error("unexpected insert target");
      }
      return {
        values(values: SubscriptionRow) {
          return {
            onConflictDoUpdate({ set }: { set: Partial<SubscriptionRow> }) {
              state.subscription = {
                ...values,
                ...set,
              };
              return Promise.resolve();
            },
          };
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: Partial<SubscriptionRow> & { tier?: string }) {
          return {
            where() {
              if (table === user && values.tier !== undefined) {
                state.userTier = values.tier;
              }
              if (table === subscriptions && state.subscription) {
                Object.assign(state.subscription, values);
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

describe("applyBillingWebhookEvent cancel semantics", () => {
  test("cancel at period end keeps paid tier until currentPeriodEnd", async () => {
    const periodEnd = new Date(Date.now() + 86_400_000);
    const state: TestBillingState = {
      subscription: {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: periodEnd,
        id: "sub_test",
        status: "active",
        tier: "plus",
        userId: "user-1",
      },
      userTier: "plus",
    };
    const db = createTestDb(state);

    const event: WebhookEvent = {
      data: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: periodEnd.toISOString(),
        subscriptionId: "sub_test",
        tier: "plus",
        userId: "user-1",
      },
      id: "evt_cancel",
      type: "subscription.canceled",
    };

    await applyBillingWebhookEvent(db, event);

    expect(state.userTier).toBe("plus");
    expect(state.subscription?.status).toBe("canceled");
    expect(state.subscription?.cancelAtPeriodEnd).toBe(true);
    expect(state.subscription?.tier).toBe("plus");
  });

  test("immediate cancel downgrades tier to free", async () => {
    const periodEnd = new Date(Date.now() + 86_400_000);
    const state: TestBillingState = {
      subscription: {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: periodEnd,
        id: "sub_test",
        status: "active",
        tier: "pro",
        userId: "user-1",
      },
      userTier: "pro",
    };
    const db = createTestDb(state);

    const event: WebhookEvent = {
      data: {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: periodEnd.toISOString(),
        subscriptionId: "sub_test",
        tier: "pro",
        userId: "user-1",
      },
      id: "evt_cancel_now",
      type: "subscription.canceled",
    };

    await applyBillingWebhookEvent(db, event);

    expect(state.userTier).toBe("free");
    expect(state.subscription?.tier).toBe("free");
  });
});
