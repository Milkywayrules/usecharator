import { characters, generationJobs, providerKeys } from "@charator/db";
import {
  canRemixCharacter,
  createCharacterRequestSchema,
  createGenerationRequestSchema,
  createProviderKeyRequestSchema,
  deriveRemixName,
  rerollGenerationRequestSchema,
  updateCharacterRequestSchema,
} from "@charator/shared";
import { and, desc, eq } from "drizzle-orm";
import { type AuthUser, db, requireAuthUser, resolveAuthUser } from "../auth";
import { config } from "../config";
import {
  completeJobFromUrls,
  defaultModelFor,
  failTimedOutJobs,
  markJobFailed,
  pollStaleRunningJobs,
  processGenerationJob,
  rememberJobCredentials,
  requeueStaleQueuedJobs,
  resolveApiKey,
  signedUrlsForJob,
} from "../jobs/processor";
import { toCharacterResponse } from "../lib/character-response";
import { decryptSecret, encryptSecret, maskApiKey } from "../lib/crypto";
import {
  assertStoredGenerationCreationAllowed,
  assertWorkspaceCharacterCreationAllowed,
  authenticatedRateLimitForTier,
  getUserTier,
} from "../lib/entitlements";
import { HttpError } from "../lib/errors";
import {
  assertReferenceCharacterOwnership,
  attachGenerationReferences,
} from "../lib/generation-create";
import { validatePublicHttpsUrl } from "../lib/public-url";
import {
  clientIpFromHeaders,
  SlidingWindowRateLimiter,
} from "../lib/rate-limit";
import { ReferenceResolutionError } from "../lib/reference-generation";
import { getProviderAdapter } from "../providers/registry";
import { createRerollJob } from "./reroll";
import { requireWorkspaceContext, resolveWorkspaceContext } from "./workspaces";

const anonymousLimiter = new SlidingWindowRateLimiter(
  config.RATE_LIMIT_ANONYMOUS_PER_HOUR,
  60 * 60 * 1000
);
const authenticatedLimiter = new SlidingWindowRateLimiter(
  config.RATE_LIMIT_AUTHENTICATED_PER_HOUR,
  60 * 60 * 1000
);

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

async function consumeGenerationRateLimit(
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

async function resolveAuthenticatedWorkspaceId(
  request: Request
): Promise<string | null> {
  const context = await resolveWorkspaceContext(request);
  return context ? context.workspaceId : null;
}

async function attachJobReferencesOrThrow(
  jobId: string,
  body: Parameters<typeof attachGenerationReferences>[2],
  userId: string | null,
  modelId: string
): Promise<void> {
  try {
    await attachGenerationReferences(db, jobId, body, userId, modelId);
  } catch (error) {
    if (error instanceof ReferenceResolutionError) {
      // biome-ignore lint/style/useErrorCause: HttpError is a typed API boundary, not a wrapper
      throw new HttpError(error.httpStatus, {
        code: "validation_error",
        message: error.message,
      });
    }
    throw error;
  }
}

export async function handleGenerationsPost(
  request: Request
): Promise<Response> {
  const authUser = await resolveAuthUser(request);
  const parsed = createGenerationRequestSchema.safeParse(
    await readJson(request)
  );
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "invalid request",
    });
  }

  await consumeGenerationRateLimit(authUser, request);

  const workspaceId = authUser
    ? await resolveAuthenticatedWorkspaceId(request)
    : null;
  if (workspaceId) {
    await assertStoredGenerationCreationAllowed(db, workspaceId);
  }

  if (parsed.data.providerKeyId && !authUser) {
    throw new HttpError(401, {
      code: "unauthorized",
      message: "sign in required to use saved provider keys",
    });
  }

  const credentials = await resolveApiKey(
    db,
    parsed.data,
    authUser ? authUser.id : null
  ).catch(() => null);
  if (!credentials) {
    throw new HttpError(400, {
      code: "invalid_key",
      message: "provider key could not be resolved",
    });
  }

  const model = defaultModelFor(parsed.data.provider, parsed.data.model);

  await assertReferenceCharacterOwnership(
    db,
    parsed.data,
    authUser ? authUser.id : null
  );

  const [job] = await db
    .insert(generationJobs)
    .values({
      aspectRatio: parsed.data.aspectRatio ?? null,
      characterId: parsed.data.characterId ?? null,
      model,
      negativePrompt: parsed.data.negativePrompt ?? null,
      prompt: parsed.data.prompt,
      provider: parsed.data.provider,
      providerKeyId: credentials.providerKeyId ?? null,
      specSnapshot: parsed.data.specSnapshot ?? null,
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
  await attachJobReferencesOrThrow(
    job.id,
    parsed.data,
    authUser ? authUser.id : null,
    model
  );
  processGenerationJob(db, job.id, credentials).catch((error) =>
    console.error(error)
  );

  return json({ jobId: job.id }, 202);
}

export async function handleGenerationGet(
  request: Request,
  jobId: string
): Promise<Response> {
  const [job] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);

  if (!job) {
    throw new HttpError(404, { code: "not_found", message: "job not found" });
  }

  const authUser = await resolveAuthUser(request);
  if (job.userId && job.userId !== authUser?.id) {
    throw new HttpError(403, {
      code: "forbidden",
      message: "job not accessible",
    });
  }

  return json({
    characterId: job.characterId,
    createdAt: job.createdAt.toISOString(),
    error: job.error,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    id: job.id,
    imageUrls:
      job.status === "succeeded" ? signedUrlsForJob(job.imageKeys) : undefined,
    model: job.model,
    provider: job.provider,
    startedAt: job.startedAt?.toISOString() ?? null,
    status: job.status,
  });
}

export async function handleGenerationReroll(
  request: Request,
  jobId: string
): Promise<Response> {
  const authUser = await resolveAuthUser(request);
  const parsed = rerollGenerationRequestSchema.safeParse(
    await readJson(request).catch(() => ({}))
  );
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "invalid request",
    });
  }

  const [source] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);

  if (!source) {
    throw new HttpError(404, { code: "not_found", message: "job not found" });
  }

  const workspaceId = authUser
    ? await resolveAuthenticatedWorkspaceId(request)
    : null;
  const result = await createRerollJob(
    db,
    source,
    parsed.data,
    authUser,
    request,
    workspaceId
  );

  return json(result, 202);
}

const DEFAULT_HISTORY_PAGE_SIZE = 20;
const MAX_HISTORY_PAGE_SIZE = 50;

export async function handleCharacterGenerations(
  request: Request,
  characterId: string
): Promise<Response> {
  const user = await requireAuthUser(request);

  const [character] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(
      and(eq(characters.id, characterId), eq(characters.ownerUserId, user.id))
    )
    .limit(1);

  if (!character) {
    throw new HttpError(404, {
      code: "not_found",
      message: "character not found",
    });
  }

  const url = new URL(request.url);
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const limitRaw = Number(
    url.searchParams.get("limit") ?? String(DEFAULT_HISTORY_PAGE_SIZE)
  );
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;
  const limit = Math.min(
    MAX_HISTORY_PAGE_SIZE,
    Math.max(
      1,
      Number.isFinite(limitRaw) ? limitRaw : DEFAULT_HISTORY_PAGE_SIZE
    )
  );

  const rows = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.characterId, characterId))
    .orderBy(desc(generationJobs.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return json({
    hasMore,
    items: page.map((job) => {
      const imageUrls =
        job.status === "succeeded" ? signedUrlsForJob(job.imageKeys) : [];
      return {
        createdAt: job.createdAt.toISOString(),
        finishedAt: job.finishedAt?.toISOString() ?? null,
        id: job.id,
        imageUrl: imageUrls[0] ?? null,
        model: job.model,
        prompt: job.prompt,
        provider: job.provider,
        status: job.status,
      };
    }),
    nextOffset: offset + page.length,
  });
}

export async function handleCharactersList(
  request: Request
): Promise<Response> {
  const context = await requireWorkspaceContext(request);
  const rows = await db
    .select()
    .from(characters)
    .where(
      and(
        eq(characters.ownerUserId, context.user.id),
        eq(characters.workspaceId, context.workspaceId)
      )
    );

  return json(rows.map((row) => toCharacterResponse(row)));
}

export async function handleCharactersPost(
  request: Request
): Promise<Response> {
  const context = await requireWorkspaceContext(request);
  await assertWorkspaceCharacterCreationAllowed(db, context.workspaceId);
  const parsed = createCharacterRequestSchema.safeParse(
    await readJson(request)
  );
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "invalid request",
    });
  }

  const [row] = await db
    .insert(characters)
    .values({
      name: parsed.data.name,
      ownerUserId: context.user.id,
      spec: parsed.data.spec,
      themeId: parsed.data.themeId ?? null,
      visibility: parsed.data.visibility,
      workspaceId: context.workspaceId,
    })
    .returning();

  if (!row) {
    throw new HttpError(500, {
      code: "internal_error",
      message: "failed to create character",
    });
  }

  return json(toCharacterResponse(row), 201);
}

export async function handleCharactersPatch(
  request: Request,
  characterId: string
): Promise<Response> {
  const user = await requireAuthUser(request);
  const parsed = updateCharacterRequestSchema.safeParse(
    await readJson(request)
  );
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "invalid request",
    });
  }

  const [existing] = await db
    .select()
    .from(characters)
    .where(
      and(eq(characters.id, characterId), eq(characters.ownerUserId, user.id))
    )
    .limit(1);

  if (!existing) {
    throw new HttpError(404, {
      code: "not_found",
      message: "character not found",
    });
  }

  const [row] = await db
    .update(characters)
    .set({
      ...(parsed.data.name === undefined ? {} : { name: parsed.data.name }),
      ...(parsed.data.spec === undefined ? {} : { spec: parsed.data.spec }),
      ...(parsed.data.themeId === undefined
        ? {}
        : { themeId: parsed.data.themeId }),
      ...(parsed.data.visibility === undefined
        ? {}
        : { visibility: parsed.data.visibility }),
      updatedAt: new Date(),
    })
    .where(eq(characters.id, characterId))
    .returning();

  if (!row) {
    throw new HttpError(500, {
      code: "internal_error",
      message: "failed to update character",
    });
  }

  return json(toCharacterResponse(row));
}

export async function handleCharactersDelete(
  request: Request,
  characterId: string
): Promise<Response> {
  const user = await requireAuthUser(request);
  const deleted = await db
    .delete(characters)
    .where(
      and(eq(characters.id, characterId), eq(characters.ownerUserId, user.id))
    )
    .returning({ id: characters.id });

  if (deleted.length === 0) {
    throw new HttpError(404, {
      code: "not_found",
      message: "character not found",
    });
  }

  return new Response(null, { status: 204 });
}

export async function handleCharactersRemix(
  request: Request,
  characterId: string
): Promise<Response> {
  const context = await requireWorkspaceContext(request);
  await assertWorkspaceCharacterCreationAllowed(db, context.workspaceId);

  const [source] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!source) {
    throw new HttpError(404, {
      code: "not_found",
      message: "character not found",
    });
  }

  if (
    !canRemixCharacter({
      moderationStatus: source.moderationStatus,
      ownerUserId: source.ownerUserId,
      viewerUserId: context.user.id,
      visibility: source.visibility,
    })
  ) {
    throw new HttpError(404, {
      code: "not_found",
      message: "character not found",
    });
  }

  const [row] = await db
    .insert(characters)
    .values({
      name: deriveRemixName(source.name),
      ownerUserId: context.user.id,
      remixedFromCharacterId: source.id,
      spec: source.spec,
      themeId: source.themeId,
      visibility: "private",
      workspaceId: context.workspaceId,
    })
    .returning();

  if (!row) {
    throw new HttpError(500, {
      code: "internal_error",
      message: "failed to create remix",
    });
  }

  return json(toCharacterResponse(row), 201);
}

export async function handleKeysList(request: Request): Promise<Response> {
  const context = await requireWorkspaceContext(request);
  const rows = await db
    .select()
    .from(providerKeys)
    .where(
      and(
        eq(providerKeys.userId, context.user.id),
        eq(providerKeys.workspaceId, context.workspaceId)
      )
    );

  return json(
    rows.map((row) => ({
      createdAt: row.createdAt.toISOString(),
      customBaseUrl: row.customBaseUrl,
      hint: maskApiKey(
        decryptSecret(row.encryptedKey, config.KEY_ENCRYPTION_MASTER_KEY)
      ),
      id: row.id,
      label: row.label,
      provider: row.provider,
    }))
  );
}

export async function handleKeysPost(request: Request): Promise<Response> {
  const context = await requireWorkspaceContext(request);
  const parsed = createProviderKeyRequestSchema.safeParse(
    await readJson(request)
  );
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "invalid request",
    });
  }

  if (parsed.data.provider === "custom" && !parsed.data.customBaseUrl) {
    throw new HttpError(400, {
      code: "validation_error",
      message: "custom provider requires customBaseUrl",
    });
  }

  if (parsed.data.customBaseUrl) {
    const urlError = await validatePublicHttpsUrl(parsed.data.customBaseUrl);
    if (urlError) {
      throw new HttpError(400, {
        code: "validation_error",
        message: urlError,
      });
    }
  }

  const encryptedKey = encryptSecret(
    parsed.data.apiKey,
    config.KEY_ENCRYPTION_MASTER_KEY
  );

  // unique (userId, provider, label) constraint — insert failure maps to 409
  const inserted = await db
    .insert(providerKeys)
    .values({
      customBaseUrl: parsed.data.customBaseUrl ?? null,
      encryptedKey,
      label: parsed.data.label,
      provider: parsed.data.provider,
      userId: context.user.id,
      workspaceId: context.workspaceId,
    })
    .returning()
    .catch(() => null);

  if (!inserted) {
    throw new HttpError(409, {
      code: "conflict",
      message: "provider key label already exists for this provider",
    });
  }

  const [row] = inserted;
  return json(
    {
      createdAt: row?.createdAt.toISOString(),
      customBaseUrl: row?.customBaseUrl,
      hint: maskApiKey(parsed.data.apiKey),
      id: row?.id,
      label: row?.label,
      provider: row?.provider,
    },
    201
  );
}

export async function handleKeysDelete(
  request: Request,
  keyId: string
): Promise<Response> {
  const user = await requireAuthUser(request);
  const deleted = await db
    .delete(providerKeys)
    .where(and(eq(providerKeys.id, keyId), eq(providerKeys.userId, user.id)))
    .returning({ id: providerKeys.id });

  if (deleted.length === 0) {
    throw new HttpError(404, {
      code: "not_found",
      message: "provider key not found",
    });
  }

  return new Response(null, { status: 204 });
}

export async function handleFalWebhook(request: Request): Promise<Response> {
  if (!config.FAL_WEBHOOK_SECRET) {
    return json({ ok: false }, 401);
  }

  const body = await readJson<unknown>(request);
  const adapter = getProviderAdapter("fal");
  const parsed = adapter.parseWebhook?.(body, request.headers);
  if (!parsed) {
    return json({ ok: false }, 400);
  }

  const [job] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.providerJobId, parsed.providerJobId))
    .limit(1);

  if (!job) {
    return json({ ok: true });
  }

  if (job.status === "succeeded" || job.status === "failed") {
    return json({ ok: true });
  }

  if (parsed.status === "failed") {
    await markJobFailed(db, job.id, parsed.error ?? "fal webhook failed");
    return json({ ok: true });
  }

  if (parsed.imageUrls?.length) {
    try {
      await completeJobFromUrls(db, job.id, parsed.imageUrls);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "webhook processing failed";
      await markJobFailed(db, job.id, message);
    }
  }

  return json({ ok: true });
}

export async function handleReplicateWebhook(
  request: Request
): Promise<Response> {
  if (!config.REPLICATE_WEBHOOK_SECRET) {
    return json({ ok: false }, 401);
  }

  const body = await readJson<unknown>(request);
  const adapter = getProviderAdapter("replicate");
  const parsed = adapter.parseWebhook?.(body, request.headers);
  if (!parsed) {
    return json({ ok: false }, 400);
  }

  const [job] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.providerJobId, parsed.providerJobId))
    .limit(1);

  if (!job) {
    return json({ ok: true });
  }

  if (job.status === "succeeded" || job.status === "failed") {
    return json({ ok: true });
  }

  if (parsed.status === "failed") {
    await markJobFailed(db, job.id, parsed.error ?? "replicate webhook failed");
    return json({ ok: true });
  }

  if (parsed.imageUrls?.length) {
    try {
      await completeJobFromUrls(db, job.id, parsed.imageUrls);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "webhook processing failed";
      await markJobFailed(db, job.id, message);
    }
  }

  return json({ ok: true });
}

export function startJobMaintenanceLoop(): void {
  setInterval(() => {
    failTimedOutJobs(db).catch((error) => console.error(error));
    pollStaleRunningJobs(db).catch((error) => console.error(error));
    requeueStaleQueuedJobs(db).catch((error) => console.error(error));
  }, config.GENERATION_POLL_INTERVAL_MS);
}
