import { characters, generationJobs, sheetBatches } from "@charator/db";
import {
  type CreateGenerationRequest,
  createSheetRequestSchema,
  formatReferenceCapableAlternatives,
  modelSupportsReferenceImages,
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
import { db } from "../auth";
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
import { withWorkspaceEntitlementLock } from "../lib/entitlement-lock";
import { assertSheetBatchCreationAllowed } from "../lib/entitlements";
import { HttpError } from "../lib/errors";
import { requireWorkspaceContext } from "./workspaces";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function assertSheetUseAnchorSupported(
  useAnchor: boolean | undefined,
  provider: CreateGenerationRequest["provider"],
  modelId: string
): void {
  if (!useAnchor) {
    return;
  }
  if (!modelSupportsReferenceImages(provider, modelId)) {
    throw new HttpError(400, {
      code: "validation_error",
      message: `useAnchor requires a reference-capable model — choose a ref-capable model: ${formatReferenceCapableAlternatives()}`,
    });
  }
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
  const context = await requireWorkspaceContext(request);
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
      and(
        eq(characters.id, characterId),
        eq(characters.ownerUserId, context.user.id),
        eq(characters.workspaceId, context.workspaceId)
      )
    )
    .limit(1);

  if (!character) {
    throw new HttpError(404, {
      code: "not_found",
      message: "character not found",
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
    context.user.id,
    context.workspaceId
  ).catch(() => null);
  if (!credentials) {
    throw new HttpError(400, {
      code: "invalid_key",
      message: "provider key could not be resolved",
    });
  }

  const model = defaultModelFor(parsed.data.provider, parsed.data.model);
  assertSheetUseAnchorSupported(
    parsed.data.useAnchor,
    parsed.data.provider,
    model
  );
  const themeId = normalizeThemeId(character.themeId);
  const baseSpec = parseCharacterSpec(character.spec);
  const variants = buildSheetVariants(
    baseSpec,
    parsed.data.preset as SheetPresetId,
    themeId
  );
  const estimatedCalls = sheetVariantCount(parsed.data.preset as SheetPresetId);

  const { batch, insertedJobs } = await withWorkspaceEntitlementLock(
    db,
    context.workspaceId,
    async (tx) => {
      await assertSheetBatchCreationAllowed(tx, context.workspaceId);

      const active = await findActiveSheetBatch(
        tx,
        characterId,
        parsed.data.preset
      );
      if (active) {
        throw new HttpError(409, {
          code: "conflict",
          message:
            "a sheet batch for this character and preset is already running",
        });
      }

      const inserted = await tx
        .insert(sheetBatches)
        .values({
          characterId,
          model,
          preset: parsed.data.preset,
          provider: parsed.data.provider,
          status: "running",
          totalCount: estimatedCalls,
          userId: context.user.id,
          workspaceId: context.workspaceId,
        })
        .returning()
        .catch(() => null);

      const createdBatch = inserted?.[0];
      if (!createdBatch) {
        throw new HttpError(409, {
          code: "conflict",
          message:
            "a sheet batch for this character and preset is already running",
        });
      }

      const jobs = await Promise.all(
        variants.map(async (variant) => {
          const [job] = await tx
            .insert(generationJobs)
            .values({
              characterId,
              model,
              negativePrompt: variant.negativePrompt ?? null,
              prompt: variant.prompt,
              provider: parsed.data.provider,
              providerKeyId: credentials.providerKeyId ?? null,
              sheetBatchId: createdBatch.id,
              sheetVariant: variant.variantId,
              specSnapshot: variant.spec,
              status: "queued",
              userId: context.user.id,
              workspaceId: context.workspaceId,
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

      return { batch: createdBatch, insertedJobs: jobs };
    }
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
          userId: context.user.id,
        })
      )
    );
  }

  seedSheetJobCredentials(jobIds, credentials, context.user.id);
  await dispatchQueuedSheetJobsForUser(db, context.user.id);

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
  const context = await requireWorkspaceContext(request);

  const [batch] = await db
    .select()
    .from(sheetBatches)
    .where(eq(sheetBatches.id, batchId))
    .limit(1);

  if (
    !batch ||
    batch.userId !== context.user.id ||
    batch.workspaceId !== context.workspaceId
  ) {
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
