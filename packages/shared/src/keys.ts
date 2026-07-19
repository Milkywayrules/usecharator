import { z } from "zod";
import { providerSchema } from "./providers";

export const createProviderKeyRequestSchema = z.object({
  apiKey: z.string().min(1),
  customBaseUrl: z
    .string()
    .url()
    .refine((value) => value.startsWith("https://"), {
      message: "customBaseUrl must use https",
    })
    .optional(),
  label: z.string().min(1).max(64),
  provider: providerSchema,
});

export type CreateProviderKeyRequest = z.infer<
  typeof createProviderKeyRequestSchema
>;

export const providerKeyResponseSchema = z.object({
  createdAt: z.string().datetime(),
  customBaseUrl: z.string().url().nullable(),
  hint: z.string(),
  id: z.string().uuid(),
  label: z.string(),
  provider: providerSchema,
});

export type ProviderKeyResponse = z.infer<typeof providerKeyResponseSchema>;
