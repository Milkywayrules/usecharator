import type { Db } from "@charator/db";
import { generationJobs } from "@charator/db";
import {
  evaluateRerollEligibility,
  type RerollGenerationRequest,
} from "@charator/shared";
import type { AuthUser } from "../auth";
import {
  defaultModelFor,
  processGenerationJob,
  rememberJobCredentials,
  resolveApiKey,
} from "../jobs/processor";
import { withWorkspaceEntitlementLock } from "../lib/entitlement-lock";
import { assertStoredGenerationCreationAllowed } from "../lib/entitlements";
import { HttpError } from "../lib/errors";
import { assertWorkspaceScopedJobAccess } from "../lib/generation-access";
import { consumeGenerationRateLimit } from "../lib/generation-rate-limit";

export async function createRerollJob(
  database: Db,
  source: typeof generationJobs.$inferSelect,
  body: RerollGenerationRequest,
  authUser: AuthUser | null,
  request: Request,
  workspaceId: string | null
): Promise<{ jobId: string }> {
  assertWorkspaceScopedJobAccess(
    source,
    authUser?.id ?? null,
    workspaceId && authUser ? { userId: authUser.id, workspaceId } : null
  );

  const providerKeyId = body.providerKeyId ?? source.providerKeyId ?? undefined;
  const hasInlineApiKey = Boolean(body.apiKey);
  const hasProviderKeyId = Boolean(providerKeyId);

  const eligibility = evaluateRerollEligibility({
    hasInlineApiKey,
    hasProviderKeyId,
    requestUserId: authUser?.id ?? null,
    sourceStatus: source.status,
    sourceUserId: source.userId,
  });
  if (!eligibility.ok) {
    const status = eligibility.code === "forbidden" ? 403 : 400;
    throw new HttpError(status, {
      code: eligibility.code,
      message: eligibility.message,
    });
  }

  await consumeGenerationRateLimit(authUser, request);

  if (providerKeyId && !authUser) {
    throw new HttpError(401, {
      code: "unauthorized",
      message: "sign in required to use saved provider keys",
    });
  }

  const credentials = await resolveApiKey(
    database,
    {
      ...(body.apiKey ? { apiKey: body.apiKey } : {}),
      ...(providerKeyId ? { providerKeyId } : {}),
      prompt: source.prompt,
      provider: source.provider,
    },
    authUser ? authUser.id : null,
    workspaceId
  ).catch(() => null);
  if (!credentials) {
    throw new HttpError(400, {
      code: "invalid_key",
      message: "provider key could not be resolved",
    });
  }

  const jobValues = {
    aspectRatio: source.aspectRatio,
    characterId: source.characterId,
    model: source.model || defaultModelFor(source.provider),
    negativePrompt: source.negativePrompt,
    prompt: source.prompt,
    provider: source.provider,
    providerKeyId: credentials.providerKeyId ?? null,
    referenceImageKeys: source.referenceImageKeys,
    referenceStrength: source.referenceStrength,
    specSnapshot: source.specSnapshot,
    status: "queued" as const,
    userId: authUser ? authUser.id : null,
    workspaceId,
  };

  const job = workspaceId
    ? await withWorkspaceEntitlementLock(database, workspaceId, async (tx) => {
        await assertStoredGenerationCreationAllowed(tx, workspaceId);
        const [inserted] = await tx
          .insert(generationJobs)
          .values(jobValues)
          .returning();
        return inserted;
      })
    : (await database.insert(generationJobs).values(jobValues).returning())[0];

  if (!job) {
    throw new HttpError(500, {
      code: "internal_error",
      message: "failed to create job",
    });
  }

  rememberJobCredentials(job.id, credentials, authUser ? authUser.id : null);
  processGenerationJob(database, job.id, credentials).catch((error) =>
    console.error(error)
  );

  return { jobId: job.id };
}
