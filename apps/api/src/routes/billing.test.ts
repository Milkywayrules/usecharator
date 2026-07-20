import { describe, expect, test } from "bun:test";
import { signWebhookPayload } from "@charator/payments";
import { paymentProvider } from "../lib/payment-provider";

describe("billing webhook verification", () => {
  test("bad webhook signature rejects without tier side effects", () => {
    const payload = JSON.stringify({
      data: { tier: "studio", userId: "user-1" },
      id: "evt_bad",
      type: "checkout.completed",
    });

    expect(() =>
      paymentProvider.verifyWebhook(payload, "t=1,v1=deadbeef")
    ).toThrow();
  });

  test("verified checkout.completed event shape is accepted", () => {
    const payload = JSON.stringify({
      data: {
        currentPeriodEnd: new Date().toISOString(),
        subscriptionId: "sub_test_api",
        tier: "pro",
        userId: "user-1",
      },
      id: "evt_ok",
      type: "checkout.completed",
    });
    const signature = signWebhookPayload(
      process.env.PAYMENT_WEBHOOK_SECRET ?? "test-payment-webhook-secret",
      payload
    );
    const event = paymentProvider.verifyWebhook(payload, signature);
    expect(event.type).toBe("checkout.completed");
    expect(event.data.tier).toBe("pro");
  });
});
