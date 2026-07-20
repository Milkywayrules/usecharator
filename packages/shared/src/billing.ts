import { z } from "zod";
import { tierIdSchema } from "./tiers";

export const subscriptionStatusSchema = z.enum([
  "active",
  "canceled",
  "past_due",
  "trialing",
]);

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const billingCheckoutRequestSchema = z.object({
  tier: tierIdSchema,
});

export type BillingCheckoutRequest = z.infer<
  typeof billingCheckoutRequestSchema
>;

export const billingCheckoutResponseSchema = z.object({
  url: z.string().url(),
});

export type BillingCheckoutResponse = z.infer<
  typeof billingCheckoutResponseSchema
>;

export const billingPortalResponseSchema = z.object({
  url: z.string().url(),
});

export type BillingPortalResponse = z.infer<typeof billingPortalResponseSchema>;

export const billingSubscriptionSchema = z.object({
  cancelAtPeriodEnd: z.boolean(),
  currentPeriodEnd: z.string().datetime(),
  id: z.string(),
  status: subscriptionStatusSchema,
  tier: tierIdSchema,
});

export type BillingSubscription = z.infer<typeof billingSubscriptionSchema>;

export const billingSubscriptionResponseSchema = z.object({
  subscription: billingSubscriptionSchema.nullable(),
  tier: tierIdSchema,
});

export type BillingSubscriptionResponse = z.infer<
  typeof billingSubscriptionResponseSchema
>;

export const billingMockCompleteRequestSchema = z.object({
  sessionId: z.string().min(1),
});

export type BillingMockCompleteRequest = z.infer<
  typeof billingMockCompleteRequestSchema
>;

export const billingCancelRequestSchema = z.object({
  atPeriodEnd: z.boolean().optional().default(true),
});

export type BillingCancelRequest = z.infer<typeof billingCancelRequestSchema>;
