import type { SubscriptionStatus, TierId } from "@charator/shared";
import { z } from "zod";

export interface Subscription {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date;
  id: string;
  status: SubscriptionStatus;
  tier: TierId;
  userId: string;
}

export const webhookEventTypeSchema = z.enum([
  "checkout.completed",
  "subscription.updated",
  "subscription.canceled",
]);

export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>;

export interface WebhookEvent {
  data: {
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string;
    sessionId?: string;
    status?: SubscriptionStatus;
    subscriptionId?: string;
    tier?: TierId;
    userId: string;
  };
  id: string;
  type: WebhookEventType;
}

export interface CreateCheckoutSessionInput {
  cancelUrl: string;
  successUrl: string;
  tier: TierId;
  userId: string;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
}

export interface BillingPortalSessionResult {
  url: string;
}

export interface CancelSubscriptionOptions {
  atPeriodEnd: boolean;
}

export interface PaymentProvider {
  cancelSubscription: (
    userId: string,
    options: CancelSubscriptionOptions
  ) => Promise<WebhookEvent>;
  createBillingPortalSession: (input: {
    returnUrl: string;
    userId: string;
  }) => Promise<BillingPortalSessionResult>;
  createCheckoutSession: (
    input: CreateCheckoutSessionInput
  ) => Promise<CheckoutSessionResult>;
  getSubscription: (userId: string) => Promise<Subscription | null>;
  verifyWebhook: (rawBody: string, signature: string) => WebhookEvent;
}

export interface PaymentProviderConfig {
  paymentProvider: string;
  paymentWebhookSecret: string;
  webAppUrl: string;
}
