import type { Db } from "@charator/db";
import { characters, generationJobs } from "@charator/db";
import type { CreateGenerationRequest, Provider } from "@charator/shared";
import {
  formatReferenceCapableAlternatives,
  modelSupportsReferenceImages,
  modelSupportsReferenceStrength,
  parseReferenceDataUrl,
  referenceImageMaxCount,
} from "@charator/shared";
import { and, eq } from "drizzle-orm";
import {
  copyGenerationImageToAnchor,
  fetchObjectBytes,
  presignedGetUrl,
  uploadJobReferenceImage,
} from "./r2";

export class ReferenceResolutionError extends Error {
  readonly httpStatus: number;

  constructor(message: string, httpStatus = 400) {
    super(message);
    this.name = "ReferenceResolutionError";
    this.httpStatus = httpStatus;
  }
}

export interface ResolvedGenerationReferences {
  referenceImageKeys: string[];
  referenceStrength: number | null;
}

function assertReferenceCapability(
  provider: Provider,
  modelId: string,
  referenceCount: number
): void {
  if (!modelSupportsReferenceImages(provider, modelId)) {
    throw new ReferenceResolutionError(
      `model ${provider}/${modelId} does not support reference images — choose a ref-capable model: ${formatReferenceCapableAlternatives()}`
    );
  }
  const maxCount = referenceImageMaxCount(provider, modelId);
  if (referenceCount > maxCount) {
    throw new ReferenceResolutionError(
      `model ${provider}/${modelId} accepts at most ${maxCount} reference image(s)`
    );
  }
}

function mimeTypeForObjectKey(key: string): string {
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (key.endsWith(".webp")) {
    return "image/webp";
  }
  return "image/png";
}

async function resolveFromJobImage(
  db: Db,
  body: CreateGenerationRequest,
  userId: string,
  modelId: string
): Promise<ResolvedGenerationReferences> {
  const imageIndex = body.referenceJobImage?.imageIndex ?? 0;
  const [job] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.id, body.referenceJobImage?.jobId ?? ""),
        eq(generationJobs.userId, userId),
        eq(generationJobs.status, "succeeded")
      )
    )
    .limit(1);

  if (!job) {
    throw new ReferenceResolutionError("reference job not found or not owned");
  }

  const sourceKey = job.imageKeys[imageIndex];
  if (!sourceKey) {
    throw new ReferenceResolutionError("reference image index out of range");
  }

  assertReferenceCapability(body.provider, modelId, 1);
  return {
    referenceImageKeys: [sourceKey],
    referenceStrength: body.referenceStrength ?? null,
  };
}

async function resolveFromCharacterAnchor(
  db: Db,
  body: CreateGenerationRequest,
  userId: string,
  modelId: string
): Promise<ResolvedGenerationReferences> {
  if (!body.characterId) {
    throw new ReferenceResolutionError(
      "useCharacterAnchor requires characterId on the generation request"
    );
  }

  const [character] = await db
    .select()
    .from(characters)
    .where(
      and(
        eq(characters.id, body.characterId),
        eq(characters.ownerUserId, userId)
      )
    )
    .limit(1);

  if (!character?.referenceImageKey) {
    throw new ReferenceResolutionError("character has no anchor image");
  }

  assertReferenceCapability(body.provider, modelId, 1);
  return {
    referenceImageKeys: [character.referenceImageKey],
    referenceStrength: body.referenceStrength ?? null,
  };
}

async function resolveFromDataUrl(
  body: CreateGenerationRequest,
  modelId: string,
  jobId: string
): Promise<ResolvedGenerationReferences> {
  const parsed = parseReferenceDataUrl(body.referenceImageDataUrl ?? "");
  if (!parsed.ok) {
    throw new ReferenceResolutionError(parsed.error);
  }

  assertReferenceCapability(body.provider, modelId, 1);
  const key = await uploadJobReferenceImage(
    jobId,
    parsed.value.bytes,
    parsed.value.mimeType,
    parsed.value.ext
  );
  return {
    referenceImageKeys: [key],
    referenceStrength: body.referenceStrength ?? null,
  };
}

export async function resolveGenerationReferences(
  db: Db,
  body: CreateGenerationRequest,
  userId: string | null,
  modelId: string,
  jobId: string
): Promise<ResolvedGenerationReferences | null> {
  const wantsReference = Boolean(
    body.useCharacterAnchor ||
      body.referenceJobImage ||
      body.referenceImageDataUrl
  );

  if (!wantsReference) {
    return null;
  }

  if (
    body.referenceStrength !== undefined &&
    !modelSupportsReferenceStrength(body.provider, modelId)
  ) {
    throw new ReferenceResolutionError(
      `model ${body.provider}/${modelId} does not support reference strength`
    );
  }

  if (body.referenceJobImage) {
    if (!userId) {
      throw new ReferenceResolutionError(
        "referenceJobImage requires a signed-in user",
        401
      );
    }
    return await resolveFromJobImage(db, body, userId, modelId);
  }

  if (body.useCharacterAnchor) {
    if (!userId) {
      throw new ReferenceResolutionError(
        "useCharacterAnchor requires a signed-in user",
        401
      );
    }
    return await resolveFromCharacterAnchor(db, body, userId, modelId);
  }

  if (body.referenceImageDataUrl) {
    if (userId) {
      throw new ReferenceResolutionError(
        "referenceImageDataUrl is only allowed for anonymous generation"
      );
    }
    return await resolveFromDataUrl(body, modelId, jobId);
  }

  return null;
}

export async function setCharacterAnchorFromJob(
  db: Db,
  userId: string,
  characterId: string,
  fromJobId: string,
  imageIndex = 0
): Promise<string> {
  const [character] = await db
    .select()
    .from(characters)
    .where(
      and(eq(characters.id, characterId), eq(characters.ownerUserId, userId))
    )
    .limit(1);

  if (!character) {
    throw new ReferenceResolutionError("character not found", 404);
  }

  const [job] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.id, fromJobId),
        eq(generationJobs.userId, userId),
        eq(generationJobs.workspaceId, character.workspaceId),
        eq(generationJobs.status, "succeeded")
      )
    )
    .limit(1);

  if (!job) {
    throw new ReferenceResolutionError(
      "source job not found or not owned",
      404
    );
  }

  const sourceKey = job.imageKeys[imageIndex];
  if (!sourceKey) {
    throw new ReferenceResolutionError("image index out of range");
  }

  const anchorKey = await copyGenerationImageToAnchor(sourceKey, characterId);
  await db
    .update(characters)
    .set({ referenceImageKey: anchorKey, updatedAt: new Date() })
    .where(eq(characters.id, characterId));

  return anchorKey;
}

export async function setCharacterAnchorFromBytes(
  db: Db,
  userId: string,
  characterId: string,
  bytes: Uint8Array,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  ext: "jpg" | "png" | "webp"
): Promise<string> {
  const [character] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(
      and(eq(characters.id, characterId), eq(characters.ownerUserId, userId))
    )
    .limit(1);

  if (!character) {
    throw new ReferenceResolutionError("character not found", 404);
  }

  const { uploadAnchorImage } = await import("./r2");
  const anchorKey = await uploadAnchorImage(characterId, bytes, mimeType, ext);
  await db
    .update(characters)
    .set({ referenceImageKey: anchorKey, updatedAt: new Date() })
    .where(eq(characters.id, characterId));

  return anchorKey;
}

export async function clearCharacterAnchor(
  db: Db,
  userId: string,
  characterId: string
): Promise<void> {
  const [character] = await db
    .select()
    .from(characters)
    .where(
      and(eq(characters.id, characterId), eq(characters.ownerUserId, userId))
    )
    .limit(1);

  if (!character) {
    throw new ReferenceResolutionError("character not found", 404);
  }

  if (character.referenceImageKey) {
    const { deleteObject } = await import("./r2");
    await deleteObject(character.referenceImageKey).catch(() => undefined);
  }

  await db
    .update(characters)
    .set({ referenceImageKey: null, updatedAt: new Date() })
    .where(eq(characters.id, characterId));
}

export interface LoadedReferenceImage {
  bytes?: Uint8Array;
  mimeType: string;
  url?: string;
}

export function loadReferenceImagesForJob(
  referenceImageKeys: string[]
): Promise<LoadedReferenceImage[]> {
  return Promise.all(
    referenceImageKeys.map(async (key) => ({
      bytes: await fetchObjectBytes(key),
      mimeType: mimeTypeForObjectKey(key),
      url: presignedGetUrl(key),
    }))
  );
}
