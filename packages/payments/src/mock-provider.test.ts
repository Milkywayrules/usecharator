import { describe, expect, test } from "bun:test";
import { signWebhookPayload, verifyWebhookPayload } from "./webhook-crypto";

describe("mock checkout session helpers", () => {
  test("buildCheckoutCompletedEvent includes tier and user", () => {
    const event = {
      data: {
        currentPeriodEnd: new Date().toISOString(),
        sessionId: "cs_mock_test",
        status: "active" as const,
        subscriptionId: "sub_mock_test",
        tier: "plus" as const,
        userId: "user_test",
      },
      id: "evt_mock_test",
      type: "checkout.completed" as const,
    };
    const rawBody = JSON.stringify(event);
    const signature = signWebhookPayload("secret", rawBody);
    expect(() =>
      verifyWebhookPayload("secret", rawBody, signature)
    ).not.toThrow();
    expect(event.data.tier).toBe("plus");
  });
});
