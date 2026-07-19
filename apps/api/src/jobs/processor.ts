import type { Db } from "@charator/db";
import { generationJobs, providerKeys } from "@charator/db";
import {
  type AspectRatio,
  type CreateGenerationRequest,
  providerModelDefaults,
} from "@charator/shared";
import { and, eq, inArray } from "drizzle-orm";
import { config, r2Configured } from "../config";
import { decryptSecret } from "../lib/crypto";
import {
  clearEphemeralCredentials,
  getEphemeralCredentials,
  setEphemeralCredentials,
} from "../lib/ephemeral-credentials";
import { redactSecrets } from "../lib/errors";
import { assertPublicHttpsUrl } from "../lib/public-url";
import {
  fetchImageFromUrl,
  presignedGetUrl,
  uploadGenerationImage,
} from "../lib/r2";
import { getProviderAdapter } from "../providers/registry";
import type { ProviderAdapter } from "../providers/types";

// dynamic import keeps lib/telegram out of the processor module graph;
// notification failures must never affect job status, so errors only log.
function dispatchTelegramNotify(
  db: Db,
  job: typeof generationJobs.$inferSelect
): void {
  import("../lib/telegram")
    .then(({ notifyJobFinished }) => notifyJobFinished(db, job))
    .catch((error) =>
      console.error(`telegram notify dispatch failed for job ${job.id}`, error)
    );
}

export async function resolveApiKey(
  db: Db,
  body: CreateGenerationRequest,
  userId: string | null
): Promise<{ apiKey: string; baseUrl?: string; providerKeyId?: string }> {
  if (body.apiKey) {
    return { apiKey: body.apiKey };
  }

  if (!(body.providerKeyId && userId)) {
    throw new Error("provider key required");
  }

  const [row] = await db
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.id, body.providerKeyId))
    .limit(1);

  if (!row || row.userId !== userId) {
    throw new Error("provider key not found");
  }

  return {
    apiKey: decryptSecret(row.encryptedKey, config.KEY_ENCRYPTION_MASTER_KEY),
    baseUrl: row.customBaseUrl ?? undefined,
    providerKeyId: row.id,
  };
}

export async function resolveJobCredentials(
  db: Db,
  job: typeof generationJobs.$inferSelect
): Promise<{ apiKey: string; baseUrl?: string } | null> {
  const ephemeral = getEphemeralCredentials(job.id);
  if (ephemeral) {
    return { apiKey: ephemeral.apiKey, baseUrl: ephemeral.baseUrl };
  }

  if (job.providerKeyId) {
    const [row] = await db
      .select()
      .from(providerKeys)
      .where(eq(providerKeys.id, job.providerKeyId))
      .limit(1);

    if (row) {
      return {
        apiKey: decryptSecret(
          row.encryptedKey,
          config.KEY_ENCRYPTION_MASTER_KEY
        ),
        baseUrl: row.customBaseUrl ?? undefined,
      };
    }
  }

  if (!job.userId) {
    return null;
  }

  const keys = await db
    .select()
    .from(providerKeys)
    .where(eq(providerKeys.userId, job.userId));

  const match = keys.find((row) => row.provider === job.provider);
  if (!match) {
    return null;
  }

  return {
    apiKey: decryptSecret(match.encryptedKey, config.KEY_ENCRYPTION_MASTER_KEY),
    baseUrl: match.customBaseUrl ?? undefined,
  };
}

export function defaultModelFor(provider: string, model?: string): string {
  if (model) {
    return model;
  }
  return providerModelDefaults[provider as keyof typeof providerModelDefaults];
}

export function signedUrlsForJob(imageKeys: string[]): string[] {
  if (!r2Configured(config) || imageKeys.length === 0) {
    return [];
  }
  return imageKeys.map((key) => presignedGetUrl(key));
}

export async function failTimedOutJobs(db: Db): Promise<void> {
  const cutoff = new Date(Date.now() - config.GENERATION_JOB_TIMEOUT_MS);
  const stale = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.status, "running"));

  for (const job of stale) {
    const started = job.startedAt ?? job.createdAt;
    if (started < cutoff) {
      await markJobFailed(db, job.id, "generation timed out");
      clearEphemeralCredentials(job.id);
    }
  }
}

const ACTIVE_JOB_STATUSES = ["queued", "running"] as const;

function activeJobWhere(jobId: string) {
  return and(
    eq(generationJobs.id, jobId),
    inArray(generationJobs.status, [...ACTIVE_JOB_STATUSES])
  );
}

export async function markJobFailed(
  db: Db,
  jobId: string,
  error: string
): Promise<void> {
  const [updated] = await db
    .update(generationJobs)
    .set({
      error: redactSecrets(error).slice(0, 2000),
      finishedAt: new Date(),
      status: "failed",
      updatedAt: new Date(),
    })
    .where(activeJobWhere(jobId))
    .returning();
  clearEphemeralCredentials(jobId);
  if (updated) {
    dispatchTelegramNotify(db, updated);
  }
}

export async function markJobRunning(db: Db, jobId: string): Promise<void> {
  await db
    .update(generationJobs)
    .set({
      startedAt: new Date(),
      status: "running",
      updatedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));
}

export async function persistJobImages(
  db: Db,
  jobId: string,
  images: Uint8Array[]
): Promise<string[]> {
  if (!r2Configured(config)) {
    throw new Error("R2 is not configured");
  }

  const keys: string[] = [];
  for (const [index, image] of images.entries()) {
    keys.push(await uploadGenerationImage(jobId, index, image));
  }

  const [updated] = await db
    .update(generationJobs)
    .set({
      error: null,
      finishedAt: new Date(),
      imageKeys: keys,
      status: "succeeded",
      updatedAt: new Date(),
    })
    .where(activeJobWhere(jobId))
    .returning();

  clearEphemeralCredentials(jobId);
  if (updated) {
    dispatchTelegramNotify(db, updated);
  }
  return keys;
}

export async function completeJobFromUrls(
  db: Db,
  jobId: string,
  urls: string[]
): Promise<void> {
  const images = await Promise.all(urls.map((url) => fetchImageFromUrl(url)));
  await persistJobImages(db, jobId, images);
}

const TRAILING_SLASH_RE = /\/$/;

const WEBHOOK_PATHS: Partial<Record<string, string>> = {
  fal: "/api/webhooks/fal",
  replicate: "/api/webhooks/replicate",
};

export function webhookBaseUrl(): string {
  return config.BETTER_AUTH_URL.replace(TRAILING_SLASH_RE, "");
}

export async function processGenerationJob(
  db: Db,
  jobId: string,
  credentials: { apiKey: string; baseUrl?: string }
): Promise<void> {
  const [job] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);

  if (job?.status !== "queued") {
    return;
  }

  await markJobRunning(db, jobId);

  if (credentials.baseUrl) {
    await assertPublicHttpsUrl(credentials.baseUrl);
  }

  const adapter = getProviderAdapter(job.provider);
  const webhookPath = WEBHOOK_PATHS[job.provider];
  const webhookEnabled =
    (job.provider === "fal" && config.FAL_WEBHOOK_SECRET) ||
    (job.provider === "replicate" && config.REPLICATE_WEBHOOK_SECRET);
  const webhookUrl =
    webhookPath && webhookEnabled
      ? `${webhookBaseUrl()}${webhookPath}`
      : undefined;

  try {
    const result = await adapter.generate({
      apiKey: credentials.apiKey,
      aspectRatio: (job.aspectRatio ?? undefined) as AspectRatio | undefined,
      baseUrl: credentials.baseUrl,
      model: job.model,
      negativePrompt: job.negativePrompt ?? undefined,
      prompt: job.prompt,
      webhookUrl,
    });

    if (result.kind === "sync") {
      await persistJobImages(db, jobId, result.images);
      return;
    }

    await db
      .update(generationJobs)
      .set({
        providerJobId: result.providerJobId,
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, jobId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "generation failed";
    await markJobFailed(db, jobId, message);
    clearEphemeralCredentials(jobId);
  }
}

export async function pollRunningJob(
  db: Db,
  job: typeof generationJobs.$inferSelect,
  credentials: { apiKey: string; baseUrl?: string },
  adapter: ProviderAdapter
): Promise<void> {
  if (!(job.providerJobId && adapter.poll)) {
    return;
  }

  const pollResult = await adapter.poll(
    job.providerJobId,
    credentials.apiKey,
    job.model
  );

  if (pollResult.status === "running") {
    return;
  }

  if (pollResult.status === "failed") {
    await markJobFailed(db, job.id, pollResult.error);
    return;
  }

  await persistJobImages(db, job.id, pollResult.images);
}

export async function pollStaleRunningJobs(db: Db): Promise<void> {
  const running = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.status, "running"));

  for (const job of running) {
    if (!job.providerJobId) {
      continue;
    }

    const adapter = getProviderAdapter(job.provider);
    if (!adapter.poll) {
      continue;
    }

    const credentials = await resolveJobCredentials(db, job);
    if (!credentials) {
      continue;
    }

    try {
      await pollRunningJob(db, job, credentials, adapter);
    } catch (error) {
      console.error(`poll failed for job ${job.id}`, error);
    }
  }
}

const QUEUED_RECOVERY_AGE_MS = 30_000;

export async function requeueStaleQueuedJobs(db: Db): Promise<void> {
  const cutoff = new Date(Date.now() - QUEUED_RECOVERY_AGE_MS);
  const queued = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.status, "queued"));

  for (const job of queued) {
    if (job.createdAt >= cutoff) {
      continue;
    }

    const credentials = await resolveJobCredentials(db, job);
    if (!credentials) {
      await markJobFailed(db, job.id, "key no longer available, please retry");
      continue;
    }

    processGenerationJob(db, job.id, credentials).catch((error) =>
      console.error(error)
    );
  }
}

export function rememberJobCredentials(
  jobId: string,
  credentials: { apiKey: string; baseUrl?: string; providerKeyId?: string },
  userId: string | null
): void {
  setEphemeralCredentials(jobId, {
    apiKey: credentials.apiKey,
    baseUrl: credentials.baseUrl,
    providerKeyId: credentials.providerKeyId,
    userId: userId ?? undefined,
  });
}
