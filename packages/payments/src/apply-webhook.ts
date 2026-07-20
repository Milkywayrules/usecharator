import { type Db, subscriptions, user } from "@charator/db";
import { parseTierId, type TierId } from "@charator/shared";
import { eq } from "drizzle-orm";
import type { WebhookEvent } from "./types";

async function applySubscriptionCanceledEvent(
  db: Db,
  data: WebhookEvent["data"]
): Promise<void> {
  const { userId } = data;
  const cancelAtPeriodEnd = data.cancelAtPeriodEnd ?? false;
  const currentPeriodEnd = data.currentPeriodEnd
    ? new Date(data.currentPeriodEnd)
    : new Date(0);
  const keepPaidTier =
    cancelAtPeriodEnd && currentPeriodEnd.getTime() > Date.now();
  const paidTier = parseTierId(data.tier);
  const tier: TierId = keepPaidTier ? paidTier : "free";

  if (!keepPaidTier) {
    await db.update(user).set({ tier }).where(eq(user.id, userId));
  }

  const subscriptionUpdate = {
    cancelAtPeriodEnd,
    currentPeriodEnd,
    status: "canceled" as const,
    tier,
    updatedAt: new Date(),
  };

  if (data.subscriptionId) {
    await db
      .update(subscriptions)
      .set(subscriptionUpdate)
      .where(eq(subscriptions.id, data.subscriptionId));
    return;
  }

  await db
    .update(subscriptions)
    .set(subscriptionUpdate)
    .where(eq(subscriptions.userId, userId));
}

export async function applyBillingWebhookEvent(
  db: Db,
  event: WebhookEvent
): Promise<void> {
  const { data, type } = event;
  const { userId } = data;

  if (type === "checkout.completed" || type === "subscription.updated") {
    const tier = parseTierId(data.tier);
    const currentPeriodEnd = data.currentPeriodEnd
      ? new Date(data.currentPeriodEnd)
      : new Date();

    await db.update(user).set({ tier }).where(eq(user.id, userId));

    if (data.subscriptionId) {
      await db
        .insert(subscriptions)
        .values({
          cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
          currentPeriodEnd,
          id: data.subscriptionId,
          provider: "mock",
          providerRef: data.sessionId ?? null,
          status: data.status ?? "active",
          tier,
          userId,
        })
        .onConflictDoUpdate({
          set: {
            cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
            currentPeriodEnd,
            status: data.status ?? "active",
            tier,
            updatedAt: new Date(),
          },
          target: subscriptions.userId,
        });
    }
    return;
  }

  if (type === "subscription.canceled") {
    await applySubscriptionCanceledEvent(db, data);
  }
}
