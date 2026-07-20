import {
  MockPaymentProvider,
  type WebhookEvent,
  WebhookSignatureError,
} from "@charator/payments";
import {
  billingCancelRequestSchema,
  billingCheckoutRequestSchema,
  billingMockCompleteRequestSchema,
  parseTierId,
  TIER_IDS,
  type TierId,
} from "@charator/shared";
import { db, requireSessionUser } from "../auth";
import { config, mockBillingEnabled } from "../config";
import { applyBillingWebhookEventForApi as applyBillingWebhookEvent } from "../lib/billing-events";
import { getUserTier } from "../lib/entitlements";
import { HttpError } from "../lib/errors";
import { paymentProvider } from "../lib/payment-provider";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function paidTierOrThrow(tier: TierId): TierId {
  if (tier === "free") {
    throw new HttpError(400, {
      code: "invalid_tier",
      message: "free tier does not require checkout",
    });
  }
  if (!TIER_IDS.includes(tier)) {
    throw new HttpError(400, {
      code: "invalid_tier",
      message: "unknown tier",
    });
  }
  return tier;
}

function resolveWebOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin) {
    return origin;
  }
  return config.WEB_APP_URL;
}

export async function handleBillingCheckoutPost(
  request: Request
): Promise<Response> {
  const sessionUser = await requireSessionUser(request);
  const body = billingCheckoutRequestSchema.parse(await request.json());
  const tier = paidTierOrThrow(parseTierId(body.tier));
  const currentTier = await getUserTier(db, sessionUser.id);

  if (currentTier === tier) {
    throw new HttpError(409, {
      code: "already_subscribed",
      message: `already on ${tier} tier`,
    });
  }

  const webOrigin = resolveWebOrigin(request);
  const result = await paymentProvider.createCheckoutSession({
    cancelUrl: `${webOrigin}/pricing`,
    successUrl: `${webOrigin}/settings#plan`,
    tier,
    userId: sessionUser.id,
  });

  return json({ url: result.url });
}

export async function handleBillingPortalPost(
  request: Request
): Promise<Response> {
  const sessionUser = await requireSessionUser(request);
  const webOrigin = resolveWebOrigin(request);
  const result = await paymentProvider.createBillingPortalSession({
    returnUrl: `${webOrigin}/settings#plan`,
    userId: sessionUser.id,
  });
  return json({ url: result.url });
}

export async function handleBillingSubscriptionGet(
  request: Request
): Promise<Response> {
  const sessionUser = await requireSessionUser(request);
  const tier = await getUserTier(db, sessionUser.id);
  const subscription = await paymentProvider.getSubscription(sessionUser.id);

  return json({
    subscription: subscription
      ? {
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          id: subscription.id,
          status: subscription.status,
          tier: subscription.tier,
        }
      : null,
    tier,
  });
}

export async function handleBillingCancelPost(
  request: Request
): Promise<Response> {
  const sessionUser = await requireSessionUser(request);
  const body = billingCancelRequestSchema.parse(await request.json());
  const event = await paymentProvider.cancelSubscription(sessionUser.id, {
    atPeriodEnd: body.atPeriodEnd,
  });
  await applyBillingWebhookEvent(event);
  return json({ ok: true });
}

export async function handleBillingWebhookPost(
  request: Request
): Promise<Response> {
  const rawBody = await request.text();
  const signature =
    request.headers.get("payment-signature") ??
    request.headers.get("Payment-Signature");

  if (!signature) {
    throw new HttpError(400, {
      code: "missing_signature",
      message: "payment-signature header required",
    });
  }

  let event: WebhookEvent;
  try {
    event = paymentProvider.verifyWebhook(rawBody, signature);
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      const httpError = new HttpError(400, {
        code: "invalid_signature",
        message: error.message,
      });
      httpError.cause = error;
      throw httpError;
    }
    throw error;
  }

  await applyBillingWebhookEvent(event);
  return json({ received: true });
}

export async function handleBillingMockCompletePost(
  request: Request
): Promise<Response> {
  if (!mockBillingEnabled(config)) {
    throw new HttpError(404, {
      code: "not_found",
      message: "mock billing endpoint unavailable",
    });
  }

  await requireSessionUser(request);
  const body = billingMockCompleteRequestSchema.parse(await request.json());

  if (!(paymentProvider instanceof MockPaymentProvider)) {
    throw new HttpError(400, {
      code: "unsupported_provider",
      message: "mock complete only available for mock provider",
    });
  }

  const { event, rawBody, signature } =
    await paymentProvider.completeCheckoutSession(body.sessionId);

  const verified = paymentProvider.verifyWebhook(rawBody, signature);
  await applyBillingWebhookEvent(verified);

  return json({
    eventType: event.type,
    ok: true,
    tier: verified.data.tier ?? null,
  });
}
