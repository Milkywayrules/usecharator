import { characters, generationJobs, sheetBatches } from "@charator/db";
import {
  type CreateGenerationRequest,
  createSheetRequestSchema,
  type SheetBatchResponse,
  type SheetPresetId,
} from "@charator/shared";
import {
  buildSheetVariants,
  getSheetPreset,
  parseCharacterSpec,
  sheetVariantCount,
  THEME_IDS,
  type ThemeId,
} from "@charator/spec";
import { and, asc, eq } from "drizzle-orm";
import { db, requireAuthUser } from "../auth";
import {
  defaultModelFor,
  resolveApiKey,
  signedUrlsForJob,
} from "../jobs/processor";
import {
  attachSheetMemberReferences,
  dispatchQueuedSheetJobsForUser,
  findActiveSheetBatch,
  seedSheetJobCredentials,
} from "../jobs/sheet-batch";
import { HttpError } from "../lib/errors";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

function normalizeThemeId(themeId: string | null): ThemeId | null {
  if (themeId && THEME_IDS.includes(themeId as ThemeId)) {
    return themeId as ThemeId;
  }
  return null;
}

export async function handleCharacterSheetPost(
  request: Request,
  characterId: string
): Promise<Response> {
  const user = await requireAuthUser(request);
  const parsed = createSheetRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "invalid request",
    });
  }

  const presetDef = getSheetPreset(parsed.data.preset);
  if (!presetDef) {
    throw new HttpError(400, {
      code: "validation_error",
      message: "unknown sheet preset",
    });
  }

  const [character] = await db
    .select()
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

  const active = await findActiveSheetBatch(
    db,
    characterId,
    parsed.data.preset
  );
  if (active) {
    throw new HttpError(409, {
      code: "conflict",
      message: "a sheet batch for this character and preset is already running",
    });
  }

  const credentials = await resolveApiKey(
    db,
    {
      ...(parsed.data.apiKey ? { apiKey: parsed.data.apiKey } : {}),
      ...(parsed.data.providerKeyId
        ? { providerKeyId: parsed.data.providerKeyId }
        : {}),
      prompt: "sheet-batch",
      provider: parsed.data.provider,
    } satisfies CreateGenerationRequest,
    user.id
  ).catch(() => null);
  if (!credentials) {
    throw new HttpError(400, {
      code: "invalid_key",
      message: "provider key could not be resolved",
    });
  }

  const model = defaultModelFor(parsed.data.provider, parsed.data.model);
  const themeId = normalizeThemeId(character.themeId);
  const baseSpec = parseCharacterSpec(character.spec);
  const variants = buildSheetVariants(
    baseSpec,
    parsed.data.preset as SheetPresetId,
    themeId
  );
  const estimatedCalls = sheetVariantCount(parsed.data.preset as SheetPresetId);

  const [batch] = await db
    .insert(sheetBatches)
    .values({
      characterId,
      model,
      preset: parsed.data.preset,
      provider: parsed.data.provider,
      status: "running",
      totalCount: estimatedCalls,
      userId: user.id,
    })
    .returning();

  if (!batch) {
    throw new HttpError(500, {
      code: "internal_error",
      message: "failed to create sheet batch",
    });
  }

  const insertedJobs = await Promise.all(
    variants.map(async (variant) => {
      const [job] = await db
        .insert(generationJobs)
        .values({
          characterId,
          model,
          negativePrompt: variant.negativePrompt ?? null,
          prompt: variant.prompt,
          provider: parsed.data.provider,
          providerKeyId: credentials.providerKeyId ?? null,
          sheetBatchId: batch.id,
          sheetVariant: variant.variantId,
          specSnapshot: variant.spec,
          status: "queued",
          userId: user.id,
        })
        .returning();

      if (!job) {
        throw new HttpError(500, {
          code: "internal_error",
          message: "failed to create sheet job",
        });
      }

      return job;
    })
  );

  const jobIds = insertedJobs.map((job) => job.id);

  if (parsed.data.useAnchor) {
    await Promise.all(
      insertedJobs.map((job) =>
        attachSheetMemberReferences(db, job.id, {
          characterId,
          modelId: model,
          provider: parsed.data.provider,
          useAnchor: true,
          userId: user.id,
        })
      )
    );
  }

  seedSheetJobCredentials(jobIds, credentials, user.id);
  await dispatchQueuedSheetJobsForUser(db, user.id);

  return json(
    {
      batchId: batch.id,
      estimatedCalls,
      jobIds,
    },
    202
  );
}

export async function handleSheetBatchGet(
  request: Request,
  batchId: string
): Promise<Response> {
  const user = await requireAuthUser(request);

  const [batch] = await db
    .select()
    .from(sheetBatches)
    .where(eq(sheetBatches.id, batchId))
    .limit(1);

  if (!batch || batch.userId !== user.id) {
    throw new HttpError(404, {
      code: "not_found",
      message: "sheet batch not found",
    });
  }

  const jobs = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.sheetBatchId, batchId))
    .orderBy(asc(generationJobs.createdAt));

  const presetDef = getSheetPreset(batch.preset);
  const labelByVariant = new Map(
    (presetDef ? presetDef.variants : []).map((variant) => [
      variant.id,
      variant.label,
    ])
  );

  const response: SheetBatchResponse = {
    batchId: batch.id,
    characterId: batch.characterId,
    createdAt: batch.createdAt.toISOString(),
    estimatedCalls: batch.totalCount,
    finishedAt: batch.finishedAt?.toISOString() ?? null,
    model: batch.model,
    preset: batch.preset as SheetPresetId,
    provider: batch.provider,
    status: batch.status,
    variants: jobs.map((job) => ({
      error: job.error,
      imageUrls:
        job.status === "succeeded"
          ? signedUrlsForJob(job.imageKeys)
          : undefined,
      jobId: job.id,
      label:
        labelByVariant.get(job.sheetVariant ?? "") ?? job.sheetVariant ?? "",
      status: job.status,
      variantId: job.sheetVariant ?? "",
    })),
  };

  return json(response);
}
