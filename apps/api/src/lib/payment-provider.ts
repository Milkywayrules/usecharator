import { getPaymentProvider } from "@charator/payments";
import { db } from "../auth";
import { config } from "../config";

export const paymentProvider = getPaymentProvider(db, {
  paymentProvider: config.PAYMENT_PROVIDER,
  paymentWebhookSecret: config.PAYMENT_WEBHOOK_SECRET,
  webAppUrl: config.WEB_APP_URL,
});
