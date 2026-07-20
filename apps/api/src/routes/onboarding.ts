import {
  characters,
  generationJobs,
  providerKeys,
  user,
} from "@charator/db";
import { createEmptySpec } from "@charator/spec";
import { and, eq, sql } from "drizzle-orm";
import { db, requireSessionUser } from "../auth";
import { withWorkspaceEntitlementLock } from "../lib/entitlement-lock";
import { assertWorkspaceCharacterCreationAllowed } from "../lib/entitlements";
import { HttpError } from "../lib/errors";
import {
  requireWorkspaceContext,
  resolveWorkspaceContext,
} from "./workspaces";

const ONBOARDING_STEPS = [
  { id: "has_provider_key" as const, label: "Add a provider API key" },
  { id: "has_character" as const, label: "Create a character" },
  { id: "has_generation" as const, label: "Run your first generation" },
];

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function workspaceStepFlags(workspaceId: string) {
  const [keyRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(providerKeys)
    .where(eq(providerKeys.workspaceId, workspaceId));

  const [characterRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(characters)
    .where(eq(characters.workspaceId, workspaceId));

  const [generationRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(generationJobs)
    .where(eq(generationJobs.workspaceId, workspaceId));

  return {
    hasCharacter: (characterRow?.count ?? 0) > 0,
    hasGeneration: (generationRow?.count ?? 0) > 0,
    hasProviderKey: (keyRow?.count ?? 0) > 0,
  };
}

function buildOnboardingPayload(
  activatedAt: Date | null,
  flags: {
    hasCharacter: boolean;
    hasGeneration: boolean;
    hasProviderKey: boolean;
  }
) {
  const stepDone: Record<(typeof ONBOARDING_STEPS)[number]["id"], boolean> = {
    has_character: flags.hasCharacter,
    has_generation: flags.hasGeneration,
    has_provider_key: flags.hasProviderKey,
  };

  const steps = ONBOARDING_STEPS.map((step) => ({
    done: stepDone[step.id],
    id: step.id,
    label: step.label,
  }));

  const completed = steps.filter((step) => step.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  return {
    activatedAt: activatedAt?.toISOString() ?? null,
    progress,
    steps,
  };
}

export async function handleOnboardingGet(request: Request): Promise<Response> {
  const sessionUser = await requireSessionUser(request);

  const [userRow] = await db
    .select({ activatedAt: user.activatedAt })
    .from(user)
    .where(eq(user.id, sessionUser.id))
    .limit(1);

  const context = await resolveWorkspaceContext(request);
  if (!context) {
    return json(
      buildOnboardingPayload(userRow?.activatedAt ?? null, {
        hasCharacter: false,
        hasGeneration: false,
        hasProviderKey: false,
      })
    );
  }

  const flags = await workspaceStepFlags(context.workspaceId);
  return json(buildOnboardingPayload(userRow?.activatedAt ?? null, flags));
}

export async function handleOnboardingSeedDemoPost(
  request: Request
): Promise<Response> {
  const context = await requireWorkspaceContext(request);

  const existing = await db
    .select({ id: characters.id })
    .from(characters)
    .where(
      and(
        eq(characters.ownerUserId, context.user.id),
        eq(characters.workspaceId, context.workspaceId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return json({ characterId: existing[0]?.id ?? null, created: false });
  }

  const spec = createEmptySpec();
  spec.meta.name = "Demo Character";

  const row = await withWorkspaceEntitlementLock(
    db,
    context.workspaceId,
    async (tx) => {
      await assertWorkspaceCharacterCreationAllowed(tx, context.workspaceId);
      const [inserted] = await tx
        .insert(characters)
        .values({
          name: "Demo Character",
          ownerUserId: context.user.id,
          spec,
          themeId: null,
          visibility: "private",
          workspaceId: context.workspaceId,
        })
        .returning();
      return inserted;
    }
  );

  if (!row) {
    throw new HttpError(500, {
      code: "internal_error",
      message: "failed to create demo character",
    });
  }

  return json({ characterId: row.id, created: true }, 201);
}
