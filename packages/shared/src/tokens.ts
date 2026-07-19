import { z } from "zod";

export const apiTokenListItemSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
  lastUsedAt: z.string().datetime().nullable(),
  name: z.string(),
  prefix: z.string(),
  revokedAt: z.string().datetime().nullable(),
});

export type ApiTokenListItem = z.infer<typeof apiTokenListItemSchema>;

export const createApiTokenRequestSchema = z.object({
  name: z.string().trim().min(1).max(128),
});

export type CreateApiTokenRequest = z.infer<typeof createApiTokenRequestSchema>;

export const createApiTokenResponseSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
  name: z.string(),
  prefix: z.string(),
  token: z.string(),
});

export type CreateApiTokenResponse = z.infer<
  typeof createApiTokenResponseSchema
>;

export const specRenderRequestSchema = z.object({
  spec: z.unknown(),
  theme: z.string().min(1).optional(),
});

export type SpecRenderRequest = z.infer<typeof specRenderRequestSchema>;

export const specRenderResponseSchema = z.object({
  errors: z.array(z.string()).optional(),
  negativePrompt: z.string().optional(),
  prompt: z.string().optional(),
});

export type SpecRenderResponse = z.infer<typeof specRenderResponseSchema>;
