import { billingCheckoutSessions, type Db, subscriptions } from "@charator/db";
import { parseTierId, type TierId } from "@charator/shared";
import { and, eq } from "drizzle-orm";
import type {
  CancelSubscriptionOptions,
  CheckoutSessionResult,
  CreateCheckoutSessionInput,
  PaymentProvider,
  PaymentProviderConfig,
  Subscription,
  WebhookEvent,
} from "./types";
import {
  signWebhookPayload,
  verifyWebhookPayload,
  WebhookSignatureError,
} from "./webhook-crypto";

const CHECKOUT_TTL_MS = 60 * 60 * 1000;
export const SUBSCRIPTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
const TRAILING_SLASH_RE = /\/$/;

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function rowToSubscription(
  row: typeof subscriptions.$inferSelect
): Subscription {
  return {
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    currentPeriodEnd: row.currentPeriodEnd,
    id: row.id,
    status: row.status as Subscription["status"],
    tier: parseTierId(row.tier),
    userId: row.userId,
  };
}

export class MockPaymentProvider implements PaymentProvider {
  private readonly db: Db;
  private readonly secret: string;
  private readonly webAppUrl: string;

  constructor(db: Db, config: PaymentProviderConfig) {
    this.db = db;
    this.secret = config.paymentWebhookSecret;
    this.webAppUrl = config.webAppUrl.replace(TRAILING_SLASH_RE, "");
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CheckoutSessionResult> {
    const id = randomId("cs_mock");
    const expiresAt = new Date(Date.now() + CHECKOUT_TTL_MS);

    await this.db.insert(billingCheckoutSessions).values({
      cancelUrl: input.cancelUrl,
      expiresAt,
      id,
      status: "open",
      successUrl: input.successUrl,
      tier: input.tier,
      userId: input.userId,
    });

    const url = `${this.webAppUrl}/billing/mock-checkout?session=${encodeURIComponent(id)}`;
    return { id, url };
  }

  createBillingPortalSession(input: {
    returnUrl: string;
    userId: string;
  }): Promise<{ url: string }> {
    const returnParam = encodeURIComponent(input.returnUrl);
    return Promise.resolve({
      url: `${this.webAppUrl}/billing/mock-checkout?mode=manage&returnUrl=${returnParam}`,
    });
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    return row ? rowToSubscription(row) : null;
  }

  async cancelSubscription(
    userId: string,
    options: CancelSubscriptionOptions
  ): Promise<WebhookEvent> {
    const existing = await this.getSubscription(userId);
    if (!existing) {
      throw new Error("no active subscription");
    }

    return this.buildSubscriptionCanceledEvent({
      cancelAtPeriodEnd: options.atPeriodEnd,
      currentPeriodEnd: existing.currentPeriodEnd,
      subscriptionId: existing.id,
      tier: existing.tier,
      userId,
    });
  }

  verifyWebhook(rawBody: string, signature: string): WebhookEvent {
    try {
      verifyWebhookPayload(this.secret, rawBody, signature);
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        throw error;
      }
      throw new WebhookSignatureError("invalid signature", { cause: error });
    }
    return JSON.parse(rawBody) as WebhookEvent;
  }

  async completeCheckoutSession(sessionId: string): Promise<{
    event: WebhookEvent;
    rawBody: string;
    signature: string;
  }> {
    const [session] = await this.db
      .select()
      .from(billingCheckoutSessions)
      .where(
        and(
          eq(billingCheckoutSessions.id, sessionId),
          eq(billingCheckoutSessions.status, "open")
        )
      )
      .limit(1);

    if (!session) {
      throw new Error("checkout session not found or already completed");
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new Error("checkout session expired");
    }

    const tier = parseTierId(session.tier) as TierId;
    const subscriptionId = randomId("sub_mock");
    const currentPeriodEnd = new Date(Date.now() + SUBSCRIPTION_PERIOD_MS);

    await this.db
      .update(billingCheckoutSessions)
      .set({ status: "complete" })
      .where(eq(billingCheckoutSessions.id, sessionId));

    const event = this.buildCheckoutCompletedEvent({
      currentPeriodEnd,
      sessionId,
      subscriptionId,
      tier,
      userId: session.userId,
    });
    const rawBody = JSON.stringify(event);
    const signature = signWebhookPayload(this.secret, rawBody);
    return { event, rawBody, signature };
  }

  buildCheckoutCompletedEvent(input: {
    currentPeriodEnd: Date;
    sessionId: string;
    subscriptionId: string;
    tier: TierId;
    userId: string;
  }): WebhookEvent {
    return {
      data: {
        currentPeriodEnd: input.currentPeriodEnd.toISOString(),
        sessionId: input.sessionId,
        status: "active",
        subscriptionId: input.subscriptionId,
        tier: input.tier,
        userId: input.userId,
      },
      id: randomId("evt_mock"),
      type: "checkout.completed",
    };
  }

  buildSubscriptionCanceledEvent(input: {
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date;
    subscriptionId: string;
    tier: TierId;
    userId: string;
  }): WebhookEvent {
    return {
      data: {
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        currentPeriodEnd: input.currentPeriodEnd.toISOString(),
        status: "canceled",
        subscriptionId: input.subscriptionId,
        tier: input.tier,
        userId: input.userId,
      },
      id: randomId("evt_mock"),
      type: "subscription.canceled",
    };
  }
}
