import type { Db } from "@charator/db";
import { generationJobs, sheetBatches } from "@charator/db";
import {
  deriveSheetBatchStatus,
  modelSupportsReferenceImages,
  type SheetBatchStatus,
  sheetDispatchSlots,
} from "@charator/shared";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  markJobFailed,
  processGenerationJob,
  rememberJobCredentials,
  resolveJobCredentials,
} from "./processor";

function dispatchTelegramBatchNotify(
  db: Db,
  batch: typeof sheetBatches.$inferSelect
): void {
  import("../lib/telegram")
    .then(({ notifySheetBatchFinished }) => notifySheetBatchFinished(db, batch))
    .catch((error) =>
      console.error(`telegram batch notify failed for ${batch.id}`, error)
    );
}

export async function countRunningSheetJobsForUser(
  db: Db,
  userId: string
): Promise<number> {
  const rows = await db
    .select({ id: generationJobs.id })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.userId, userId),
        isNotNull(generationJobs.sheetBatchId),
        eq(generationJobs.status, "running")
      )
    );
  return rows.length;
}

export async function recomputeSheetBatchStatus(
  db: Db,
  batchId: string
): Promise<SheetBatchStatus | null> {
  const members = await db
    .select({ status: generationJobs.status })
    .from(generationJobs)
    .where(eq(generationJobs.sheetBatchId, batchId));

  if (members.length === 0) {
    return null;
  }

  const nextStatus = deriveSheetBatchStatus(members);
  const [batch] = await db
    .select()
    .from(sheetBatches)
    .where(eq(sheetBatches.id, batchId))
    .limit(1);

  if (!batch) {
    return null;
  }

  if (batch.status === nextStatus) {
    return nextStatus;
  }

  const terminal = nextStatus !== "running";
  const [updated] = await db
    .update(sheetBatches)
    .set({
      finishedAt: terminal ? new Date() : null,
      status: nextStatus,
    })
    .where(eq(sheetBatches.id, batchId))
    .returning();

  if (updated && terminal) {
    dispatchTelegramBatchNotify(db, updated);
  }

  return nextStatus;
}

export async function dispatchQueuedSheetJobsForUser(
  db: Db,
  userId: string
): Promise<void> {
  const runningCount = await countRunningSheetJobsForUser(db, userId);
  const slots = sheetDispatchSlots(runningCount);
  if (slots === 0) {
    return;
  }

  const queued = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.userId, userId),
        isNotNull(generationJobs.sheetBatchId),
        eq(generationJobs.status, "queued")
      )
    )
    .orderBy(asc(generationJobs.createdAt))
    .limit(slots);

  await Promise.all(
    queued.map(async (job) => {
      const credentials = await resolveJobCredentials(db, job);
      if (!credentials) {
        await markJobFailed(db, job.id, "provider key no longer available");
        return;
      }
      processGenerationJob(db, job.id, credentials).catch((error) =>
        console.error(error)
      );
    })
  );
}

export async function onSheetMemberTerminal(
  db: Db,
  job: typeof generationJobs.$inferSelect
): Promise<void> {
  if (!job.sheetBatchId) {
    return;
  }

  await recomputeSheetBatchStatus(db, job.sheetBatchId);

  if (job.userId) {
    await dispatchQueuedSheetJobsForUser(db, job.userId);
  }
}

export async function attachSheetMemberReferences(
  db: Db,
  jobId: string,
  input: {
    characterId: string;
    modelId: string;
    provider: string;
    useAnchor: boolean;
    userId: string;
  }
): Promise<void> {
  if (!input.useAnchor) {
    return;
  }

  if (
    !modelSupportsReferenceImages(
      input.provider as Parameters<typeof modelSupportsReferenceImages>[0],
      input.modelId
    )
  ) {
    return;
  }

  const body = {
    characterId: input.characterId,
    provider: input.provider,
    useCharacterAnchor: true,
  } as const;

  const { attachGenerationReferences } = await import(
    "../lib/generation-create"
  );
  const { ReferenceResolutionError } = await import(
    "../lib/reference-generation"
  );
  try {
    await attachGenerationReferences(
      db,
      jobId,
      body as Parameters<typeof attachGenerationReferences>[2],
      input.userId,
      input.modelId
    );
  } catch (error) {
    if (error instanceof ReferenceResolutionError) {
      return;
    }
    throw error;
  }
}

export function seedSheetJobCredentials(
  jobIds: string[],
  credentials: { apiKey: string; baseUrl?: string; providerKeyId?: string },
  userId: string
): void {
  for (const jobId of jobIds) {
    rememberJobCredentials(jobId, credentials, userId);
  }
}

export async function findActiveSheetBatch(
  db: Db,
  characterId: string,
  preset: string
): Promise<typeof sheetBatches.$inferSelect | null> {
  const [batch] = await db
    .select()
    .from(sheetBatches)
    .where(
      and(
        eq(sheetBatches.characterId, characterId),
        eq(sheetBatches.preset, preset),
        inArray(sheetBatches.status, ["running"])
      )
    )
    .limit(1);
  return batch ?? null;
}
