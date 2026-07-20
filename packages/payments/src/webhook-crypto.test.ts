import { describe, expect, test } from "bun:test";
import {
  signWebhookPayload,
  verifyWebhookPayload,
  WebhookSignatureError,
} from "./webhook-crypto";

describe("webhook signature", () => {
  test("valid signature verifies", () => {
    const payload = JSON.stringify({ id: "evt_1", type: "checkout.completed" });
    const signature = signWebhookPayload("secret", payload);
    expect(() =>
      verifyWebhookPayload("secret", payload, signature)
    ).not.toThrow();
  });

  test("invalid signature rejects", () => {
    const payload = JSON.stringify({ id: "evt_1" });
    const signature = signWebhookPayload("secret", payload);
    expect(() =>
      verifyWebhookPayload("other-secret", payload, signature)
    ).toThrow(WebhookSignatureError);
  });

  test("tampered body rejects", () => {
    const payload = JSON.stringify({ id: "evt_1" });
    const signature = signWebhookPayload("secret", payload);
    expect(() =>
      verifyWebhookPayload("secret", `${payload}tamper`, signature)
    ).toThrow(WebhookSignatureError);
  });
});
