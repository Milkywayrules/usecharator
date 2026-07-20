import { subscriptions, user } from "@charator/db";
import type { WebhookEvent } from "@charator/payments";
import { parseTierId, type TierId } from "@charator/shared";
import { eq } from "drizzle-orm";
import { db } from "../auth";

export async function applyBillingWebhookEvent(
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
    const tier: TierId = "free";
    await db.update(user).set({ tier }).where(eq(user.id, userId));

    if (data.subscriptionId) {
      await db
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
          status: "canceled",
          tier,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, data.subscriptionId));
    } else {
      await db
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
          status: "canceled",
          tier,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, userId));
    }
  }
}
