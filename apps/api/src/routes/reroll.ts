import type { Db } from "@charator/db";
import { generationJobs } from "@charator/db";
import {
  evaluateRerollEligibility,
  type RerollGenerationRequest,
} from "@charator/shared";
import { type AuthUser, db } from "../auth";
import { config } from "../config";
import {
  defaultModelFor,
  processGenerationJob,
  rememberJobCredentials,
  resolveApiKey,
} from "../jobs/processor";
import {
  assertStoredGenerationCreationAllowed,
  authenticatedRateLimitForTier,
  getUserTier,
} from "../lib/entitlements";
import { HttpError } from "../lib/errors";
import {
  clientIpFromHeaders,
  SlidingWindowRateLimiter,
} from "../lib/rate-limit";

const anonymousLimiter = new SlidingWindowRateLimiter(
  config.RATE_LIMIT_ANONYMOUS_PER_HOUR,
  60 * 60 * 1000
);
const authenticatedLimiter = new SlidingWindowRateLimiter(
  config.RATE_LIMIT_AUTHENTICATED_PER_HOUR,
  60 * 60 * 1000
);

async function consumeAuthenticatedRerollRateLimit(
  authUser: AuthUser | null,
  request: Request
): Promise<void> {
  const ip = clientIpFromHeaders(request.headers);
  if (!authUser) {
    const limit = anonymousLimiter.consume(`ip:${ip}`);
    if (!limit.allowed) {
      throw new HttpError(429, {
        code: "rate_limited",
        message: "too many generation requests",
      });
    }
    return;
  }

  const tier = await getUserTier(db, authUser.id);
  const hourlyLimit = authenticatedRateLimitForTier(tier);
  const limit = authenticatedLimiter.consume(
    `user:${authUser.id}`,
    Date.now(),
    hourlyLimit
  );
  if (!limit.allowed) {
    throw new HttpError(429, {
      code: "rate_limited",
      message: "too many generation requests",
    });
  }
}

export async function createRerollJob(
  database: Db,
  source: typeof generationJobs.$inferSelect,
  body: RerollGenerationRequest,
  authUser: AuthUser | null,
  request: Request,
  workspaceId: string | null
): Promise<{ jobId: string }> {
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

  await consumeAuthenticatedRerollRateLimit(authUser, request);

  if (workspaceId) {
    await assertStoredGenerationCreationAllowed(database, workspaceId);
  }

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
    authUser ? authUser.id : null
  ).catch(() => null);
  if (!credentials) {
    throw new HttpError(400, {
      code: "invalid_key",
      message: "provider key could not be resolved",
    });
  }

  const [job] = await database
    .insert(generationJobs)
    .values({
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
      status: "queued",
      userId: authUser ? authUser.id : null,
      workspaceId,
    })
    .returning();

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
