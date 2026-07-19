import { z } from "zod";

export const TIER_IDS = ["free", "plus", "pro", "studio"] as const;

export const tierIdSchema = z.enum(TIER_IDS);

export type TierId = z.infer<typeof tierIdSchema>;

export const LIMIT_KEYS = [
  "workspaces",
  "charactersPerWorkspace",
  "sheetBatchesPerMonth",
  "storedGenerationsPerWorkspace",
  "anchorImagesPerWorkspace",
  "apiTokensPerWorkspace",
  "authenticatedGenerationsPerHour",
] as const;

export const limitKeySchema = z.enum(LIMIT_KEYS);

export type LimitKey = z.infer<typeof limitKeySchema>;

/** `null` means unlimited for that tier. */
export type TierLimitValue = number | null;

export type TierLimits = Record<LimitKey, TierLimitValue>;

export const TIER_LIMITS: Record<TierId, TierLimits> = {
  free: {
    anchorImagesPerWorkspace: 10,
    apiTokensPerWorkspace: 1,
    authenticatedGenerationsPerHour: 60,
    charactersPerWorkspace: 15,
    sheetBatchesPerMonth: 3,
    storedGenerationsPerWorkspace: 100,
    workspaces: 1,
  },
  plus: {
    anchorImagesPerWorkspace: 50,
    apiTokensPerWorkspace: 3,
    authenticatedGenerationsPerHour: 120,
    charactersPerWorkspace: 75,
    sheetBatchesPerMonth: 15,
    storedGenerationsPerWorkspace: 1000,
    workspaces: 3,
  },
  pro: {
    anchorImagesPerWorkspace: 250,
    apiTokensPerWorkspace: 10,
    authenticatedGenerationsPerHour: 300,
    charactersPerWorkspace: 300,
    sheetBatchesPerMonth: 60,
    storedGenerationsPerWorkspace: 10_000,
    workspaces: 10,
  },
  studio: {
    anchorImagesPerWorkspace: null,
    apiTokensPerWorkspace: 50,
    authenticatedGenerationsPerHour: 600,
    charactersPerWorkspace: null,
    sheetBatchesPerMonth: null,
    storedGenerationsPerWorkspace: null,
    workspaces: null,
  },
};

export const TIER_DISPLAY_NAMES: Record<TierId, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
  studio: "Studio",
};

export const TIER_PRICES_USD_MONTHLY: Record<TierId, number> = {
  free: 0,
  plus: 12,
  pro: 39,
  studio: 99,
};

export function parseTierId(value: string | null | undefined): TierId {
  const parsed = tierIdSchema.safeParse(value);
  return parsed.success ? parsed.data : "free";
}

export function isUnlimited(limit: TierLimitValue): boolean {
  return limit === null;
}

export function tierLimit(tier: TierId, key: LimitKey): TierLimitValue {
  return TIER_LIMITS[tier][key];
}

export function utcPeriodForDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function currentUtcPeriod(now = new Date()): string {
  return utcPeriodForDate(now);
}

export function nextTierUp(tier: TierId): TierId | null {
  const index = TIER_IDS.indexOf(tier);
  if (index < 0 || index >= TIER_IDS.length - 1) {
    return null;
  }
  return TIER_IDS[index + 1] ?? null;
}

/** Smallest paid tier whose limit for `key` exceeds `current` (or is unlimited). */
export function suggestUpgradeTier(
  currentTier: TierId,
  key: LimitKey,
  current: number
): TierId | null {
  for (const tier of TIER_IDS) {
    if (tier === currentTier) {
      continue;
    }
    const limit = tierLimit(tier, key);
    if (limit === null || limit > current) {
      return tier;
    }
  }
  return null;
}

export function isAtOrOverLimit(
  current: number,
  limit: TierLimitValue
): boolean {
  if (limit === null) {
    return false;
  }
  return current >= limit;
}

export function tierOrderIndex(tier: TierId): number {
  return TIER_IDS.indexOf(tier);
}
