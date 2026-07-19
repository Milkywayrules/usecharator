import { z } from "zod";
import { LIMIT_KEYS, limitKeySchema, TIER_LIMITS, tierIdSchema } from "./tiers";

const tierLimitValueSchema = z.number().int().nonnegative().nullable();

export const tierLimitsSchema = z.object(
  Object.fromEntries(
    LIMIT_KEYS.map((key) => [key, tierLimitValueSchema])
  ) as Record<(typeof LIMIT_KEYS)[number], typeof tierLimitValueSchema>
);

export type TierLimitsResponse = z.infer<typeof tierLimitsSchema>;

export const entitlementsUsageSchema = z.object({
  anchorImages: z.number().int().nonnegative(),
  apiTokens: z.number().int().nonnegative(),
  characters: z.number().int().nonnegative(),
  sheetBatchesThisMonth: z.number().int().nonnegative(),
  storedGenerations: z.number().int().nonnegative(),
  workspaces: z.number().int().nonnegative(),
});

export type EntitlementsUsage = z.infer<typeof entitlementsUsageSchema>;

export const entitlementsResponseSchema = z.object({
  limits: tierLimitsSchema,
  tier: tierIdSchema,
  usage: entitlementsUsageSchema,
});

export type EntitlementsResponse = z.infer<typeof entitlementsResponseSchema>;

export const tierLimitErrorSchema = z.object({
  code: z.literal("tier_limit"),
  current: z.number().int().nonnegative(),
  limit: limitKeySchema,
  message: z.string(),
  tier: tierIdSchema,
  upgradeTier: tierIdSchema.nullable(),
});

export type TierLimitError = z.infer<typeof tierLimitErrorSchema>;

export function limitsForTier(
  tier: z.infer<typeof tierIdSchema>
): TierLimitsResponse {
  return TIER_LIMITS[tier];
}
