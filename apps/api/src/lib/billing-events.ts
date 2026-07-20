import {
  applyBillingWebhookEvent,
  type WebhookEvent,
} from "@charator/payments";
import { db } from "../auth";

export async function applyBillingWebhookEventForApi(
  event: WebhookEvent
): Promise<void> {
  await applyBillingWebhookEvent(db, event);
}
