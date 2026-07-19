import { z } from "zod";

export const telegramLinkStatusSchema = z.object({
  linked: z.boolean(),
  notifyTelegram: z.boolean(),
  telegramUsername: z.string().nullable(),
});

export type TelegramLinkStatus = z.infer<typeof telegramLinkStatusSchema>;

export const telegramLinkCodeResponseSchema = z.object({
  code: z.string(),
  deepLink: z.string().url(),
});

export type TelegramLinkCodeResponse = z.infer<
  typeof telegramLinkCodeResponseSchema
>;

export const updateTelegramLinkRequestSchema = z.object({
  notifyTelegram: z.boolean(),
});

export type UpdateTelegramLinkRequest = z.infer<
  typeof updateTelegramLinkRequestSchema
>;
