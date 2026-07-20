import type { Db } from "@charator/db";
import { MockPaymentProvider } from "./mock-provider";
import type { PaymentProvider, PaymentProviderConfig } from "./types";

export function getPaymentProvider(
  db: Db,
  config: PaymentProviderConfig
): PaymentProvider {
  switch (config.paymentProvider) {
    case "mock":
      return new MockPaymentProvider(db, config);
    default:
      throw new Error(
        `unknown PAYMENT_PROVIDER: ${config.paymentProvider} (supported: mock)`
      );
  }
}

export function resolvePaymentProviderConfig(env: {
  PAYMENT_PROVIDER?: string;
  PAYMENT_WEBHOOK_SECRET?: string;
  WEB_APP_URL?: string;
}): PaymentProviderConfig {
  return {
    paymentProvider: env.PAYMENT_PROVIDER ?? "mock",
    paymentWebhookSecret:
      env.PAYMENT_WEBHOOK_SECRET ?? "dev-payment-webhook-secret",
    webAppUrl: env.WEB_APP_URL ?? "http://localhost:3000",
  };
}
