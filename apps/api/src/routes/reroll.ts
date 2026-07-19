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
import { HttpError } from "../lib/errors";
import {
  clientIpFromHeaders,
  type SlidingWindowRateLimiter,
} from "../lib/rate-limit";

export async function createRerollJob(
  db: Db,
  source: typeof generationJobs.$inferSelect,
  body: RerollGenerationRequest,
  authUser: AuthUser | null,
  limiter: SlidingWindowRateLimiter,
  request: Request
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

  const ip = clientIpFromHeaders(request.headers);
  const limitKey = authUser ? `user:${authUser.id}` : `ip:${ip}`;
  const limit = limiter.consume(limitKey);
  if (!limit.allowed) {
    throw new HttpError(429, {
      code: "rate_limited",
      message: "too many generation requests",
    });
  }

  if (providerKeyId && !authUser) {
    throw new HttpError(401, {
      code: "unauthorized",
      message: "sign in required to use saved provider keys",
    });
  }

  const credentials = await resolveApiKey(
    db,
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

  const [job] = await db
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
    })
    .returning();

  if (!job) {
    throw new HttpError(500, {
      code: "internal_error",
      message: "failed to create job",
    });
  }

  rememberJobCredentials(job.id, credentials, authUser ? authUser.id : null);
  processGenerationJob(db, job.id, credentials).catch((error) =>
    console.error(error)
  );

  return { jobId: job.id };
}
