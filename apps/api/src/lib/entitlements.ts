import {
  apiTokens,
  characters,
  generationJobs,
  member,
  sheetBatches,
  subscriptions,
  user,
} from "@charator/db";
import {
  currentUtcPeriod,
  type EntitlementsUsage,
  isAtOrOverLimit,
  type LimitKey,
  limitsForTier,
  parseTierId,
  suggestUpgradeTier,
  type TierId,
  type TierLimitValue,
  tierLimit,
} from "@charator/shared";
import { and, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { DbExecutor } from "./entitlement-lock";
import { HttpError } from "./errors";
import { countOwnedWorkspaces } from "./workspace";

export interface ResolvedEntitlements {
  limits: ReturnType<typeof limitsForTier>;
  tier: TierId;
}

export async function getUserTier(
  db: DbExecutor,
  userId: string
): Promise<TierId> {
  const [row] = await db
    .select({ tier: user.tier })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return parseTierId(row?.tier);
}

export async function resolveEntitlements(
  db: DbExecutor,
  userId: string
): Promise<ResolvedEntitlements> {
  let tier = await getUserTier(db, userId);

  if (tier !== "free") {
    const [subscription] = await db
      .select({
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        status: subscriptions.status,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (
      subscription?.status === "canceled" &&
      subscription.cancelAtPeriodEnd &&
      subscription.currentPeriodEnd <= new Date()
    ) {
      await db.update(user).set({ tier: "free" }).where(eq(user.id, userId));
      tier = "free";
    }
  }

  return { limits: limitsForTier(tier), tier };
}

export async function getWorkspaceOwnerId(
  db: DbExecutor,
  workspaceId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: member.userId })
    .from(member)
    .where(
      and(eq(member.organizationId, workspaceId), eq(member.role, "owner"))
    )
    .limit(1);
  return row?.userId ?? null;
}

function monthBoundsUtc(period: string): { end: Date; start: Date } {
  const [yearText, monthText] = period.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { end, start };
}

export async function countWorkspaceUsage(
  db: DbExecutor,
  workspaceId: string,
  ownerUserId: string,
  period = currentUtcPeriod()
): Promise<EntitlementsUsage> {
  const { end, start } = monthBoundsUtc(period);

  const [characterCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId));

  const [batchCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sheetBatches)
    .where(
      and(
        eq(sheetBatches.workspaceId, workspaceId),
        gte(sheetBatches.createdAt, start),
        lt(sheetBatches.createdAt, end)
      )
    );

  const [generationCountThisMonth] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.workspaceId, workspaceId),
        gte(generationJobs.createdAt, start),
        lt(generationJobs.createdAt, end)
      )
    );

  const [storedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.workspaceId, workspaceId),
        eq(generationJobs.status, "succeeded")
      )
    );

  const [anchorCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(characters)
    .where(
      and(
        eq(characters.workspaceId, workspaceId),
        isNotNull(characters.referenceImageKey)
      )
    );

  const [tokenCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiTokens)
    .where(
      and(eq(apiTokens.workspaceId, workspaceId), isNull(apiTokens.revokedAt))
    );

  const workspaces = await countOwnedWorkspaces(db, ownerUserId);

  return {
    anchorImages: anchorCount?.count ?? 0,
    apiTokens: tokenCount?.count ?? 0,
    characters: characterCount?.count ?? 0,
    generationsThisMonth: generationCountThisMonth?.count ?? 0,
    sheetBatchesThisMonth: batchCount?.count ?? 0,
    storedGenerations: storedCount?.count ?? 0,
    workspaces,
  };
}

export interface EntitlementCheckInput {
  current: number;
  limitKey: LimitKey;
  ownerUserId: string;
}

const TIER_LIMIT_MESSAGES: Partial<
  Record<LimitKey, (limit: TierLimitValue) => string>
> = {
  anchorImagesPerWorkspace: (limit) =>
    `anchor image limit reached for this workspace (${limit} max)`,
  apiTokensPerWorkspace: (limit) =>
    `API token limit reached for this workspace (${limit} max)`,
  charactersPerWorkspace: (limit) =>
    `character limit reached for this workspace (${limit} max)`,
  sheetBatchesPerMonth: (limit) =>
    `monthly sheet batch limit reached (${limit} per month)`,
  storedGenerationsPerWorkspace: (limit) =>
    `stored generation limit reached (${limit} max) — delete history or upgrade`,
  workspaces: (limit) => `workspace limit reached (${limit} max)`,
};

function tierLimitMessage(limitKey: LimitKey, limit: TierLimitValue): string {
  const formatter = TIER_LIMIT_MESSAGES[limitKey];
  return formatter ? formatter(limit) : "plan limit reached";
}

export function throwTierLimitError(input: {
  current: number;
  limitKey: LimitKey;
  tier: TierId;
}): never {
  const limit = tierLimit(input.tier, input.limitKey);
  throw new HttpError(402, {
    code: "tier_limit",
    current: input.current,
    limit: input.limitKey,
    message: tierLimitMessage(input.limitKey, limit),
    tier: input.tier,
    upgradeTier: suggestUpgradeTier(input.tier, input.limitKey, input.current),
  });
}

export async function assertEntitlementForOwner(
  db: DbExecutor,
  input: EntitlementCheckInput
): Promise<void> {
  const { limits, tier } = await resolveEntitlements(db, input.ownerUserId);
  const limit = limits[input.limitKey];
  if (isAtOrOverLimit(input.current, limit)) {
    throwTierLimitError({
      current: input.current,
      limitKey: input.limitKey,
      tier,
    });
  }
}

export async function assertWorkspaceCharacterCreationAllowed(
  db: DbExecutor,
  workspaceId: string
): Promise<void> {
  const ownerUserId = await getWorkspaceOwnerId(db, workspaceId);
  if (!ownerUserId) {
    return;
  }
  const usage = await countWorkspaceUsage(db, workspaceId, ownerUserId);
  await assertEntitlementForOwner(db, {
    current: usage.characters,
    limitKey: "charactersPerWorkspace",
    ownerUserId,
  });
}

export async function assertSheetBatchCreationAllowed(
  db: DbExecutor,
  workspaceId: string
): Promise<void> {
  const ownerUserId = await getWorkspaceOwnerId(db, workspaceId);
  if (!ownerUserId) {
    return;
  }
  const usage = await countWorkspaceUsage(db, workspaceId, ownerUserId);
  await assertEntitlementForOwner(db, {
    current: usage.sheetBatchesThisMonth,
    limitKey: "sheetBatchesPerMonth",
    ownerUserId,
  });
}

export async function assertStoredGenerationCreationAllowed(
  db: DbExecutor,
  workspaceId: string
): Promise<void> {
  const ownerUserId = await getWorkspaceOwnerId(db, workspaceId);
  if (!ownerUserId) {
    return;
  }
  const usage = await countWorkspaceUsage(db, workspaceId, ownerUserId);
  await assertEntitlementForOwner(db, {
    current: usage.storedGenerations,
    limitKey: "storedGenerationsPerWorkspace",
    ownerUserId,
  });
}

export async function assertAnchorCreationAllowed(
  db: DbExecutor,
  workspaceId: string
): Promise<void> {
  const ownerUserId = await getWorkspaceOwnerId(db, workspaceId);
  if (!ownerUserId) {
    return;
  }
  const usage = await countWorkspaceUsage(db, workspaceId, ownerUserId);
  await assertEntitlementForOwner(db, {
    current: usage.anchorImages,
    limitKey: "anchorImagesPerWorkspace",
    ownerUserId,
  });
}

export async function assertApiTokenCreationAllowed(
  db: DbExecutor,
  workspaceId: string
): Promise<void> {
  const ownerUserId = await getWorkspaceOwnerId(db, workspaceId);
  if (!ownerUserId) {
    return;
  }
  const usage = await countWorkspaceUsage(db, workspaceId, ownerUserId);
  await assertEntitlementForOwner(db, {
    current: usage.apiTokens,
    limitKey: "apiTokensPerWorkspace",
    ownerUserId,
  });
}

export async function buildEntitlementsResponse(
  db: DbExecutor,
  userId: string,
  workspaceId: string
): Promise<{
  limits: ReturnType<typeof limitsForTier>;
  tier: TierId;
  usage: EntitlementsUsage;
}> {
  const { limits, tier } = await resolveEntitlements(db, userId);
  const usage = await countWorkspaceUsage(db, workspaceId, userId);
  return { limits, tier, usage };
}

export function authenticatedRateLimitForTier(tier: TierId): number {
  const limit = tierLimit(tier, "authenticatedGenerationsPerHour");
  return limit ?? 600;
}
