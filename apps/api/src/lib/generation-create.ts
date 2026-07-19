import type { Db } from "@charator/db";
import { characters, generationJobs } from "@charator/db";
import type { CreateGenerationRequest } from "@charator/shared";
import { and, eq } from "drizzle-orm";
import { markJobFailed } from "../jobs/processor";
import { HttpError } from "./errors";
import {
  ReferenceResolutionError,
  resolveGenerationReferences,
} from "./reference-generation";

export async function assertReferenceCharacterOwnership(
  db: Db,
  body: CreateGenerationRequest,
  userId: string | null
): Promise<void> {
  const wantsReference = Boolean(
    body.useCharacterAnchor ||
      body.referenceJobImage ||
      body.referenceImageDataUrl
  );
  if (!(wantsReference && body.characterId && userId)) {
    return;
  }

  const [ownedCharacter] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(
      and(
        eq(characters.id, body.characterId),
        eq(characters.ownerUserId, userId)
      )
    )
    .limit(1);

  if (!ownedCharacter) {
    throw new HttpError(403, {
      code: "forbidden",
      message: "character not owned by requester",
    });
  }
}

export async function attachGenerationReferences(
  db: Db,
  jobId: string,
  body: CreateGenerationRequest,
  userId: string | null,
  modelId: string
): Promise<void> {
  try {
    const references = await resolveGenerationReferences(
      db,
      body,
      userId,
      modelId,
      jobId
    );
    if (!references) {
      return;
    }
    await db
      .update(generationJobs)
      .set({
        referenceImageKeys: references.referenceImageKeys,
        referenceStrength: references.referenceStrength,
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, jobId));
  } catch (error) {
    await markJobFailed(
      db,
      jobId,
      error instanceof ReferenceResolutionError
        ? error.message
        : "reference resolution failed"
    );
    if (error instanceof ReferenceResolutionError) {
      throw error;
    }
    throw error;
  }
}
