import type { Db } from "@charator/db";
import { generationJobs, providerKeys } from "@charator/db";
import {
  type CreateGenerationRequest,
  providerModelDefaults,
} from "@charator/shared";
import { eq } from "drizzle-orm";
import { config, r2Configured } from "../config";
import { decryptSecret } from "../lib/crypto";
import {
  clearEphemeralCredentials,
  getEphemeralCredentials,
  setEphemeralCredentials,
} from "../lib/ephemeral-credentials";
import { redactSecrets } from "../lib/errors";
import {
  fetchImageFromUrl,
  presignedGetUrl,
  uploadGenerationImage,
} from "../lib/r2";
import { getProviderAdapter } from "../providers/registry";
import type { ProviderAdapter } from "../providers/types";

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

export async function markJobFailed(
  db: Db,
  jobId: string,
  error: string
): Promise<void> {
  await db
    .update(generationJobs)
    .set({
      error: redactSecrets(error).slice(0, 2000),
      finishedAt: new Date(),
      status: "failed",
      updatedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));
  clearEphemeralCredentials(jobId);
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

  await db
    .update(generationJobs)
    .set({
      error: null,
      finishedAt: new Date(),
      imageKeys: keys,
      status: "succeeded",
      updatedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));

  clearEphemeralCredentials(jobId);
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

  const adapter = getProviderAdapter(job.provider);
  const webhookPath = WEBHOOK_PATHS[job.provider];
  const webhookUrl = webhookPath
    ? `${webhookBaseUrl()}${webhookPath}`
    : undefined;

  try {
    const result = await adapter.generate({
      apiKey: credentials.apiKey,
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
      const message = error instanceof Error ? error.message : "poll failed";
      await markJobFailed(db, job.id, message);
      clearEphemeralCredentials(job.id);
    }
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
