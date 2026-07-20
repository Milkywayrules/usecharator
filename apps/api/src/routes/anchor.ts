import { characters } from "@charator/db";
import {
  MAX_REFERENCE_IMAGE_BYTES,
  parseReferenceDataUrl,
  setCharacterAnchorFromJobSchema,
  setCharacterAnchorUploadSchema,
  validateReferenceImageBytes,
} from "@charator/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../auth";
import { toCharacterResponse } from "../lib/character-response";
import { assertAnchorCreationAllowed } from "../lib/entitlements";
import { HttpError } from "../lib/errors";
import {
  clearCharacterAnchor,
  ReferenceResolutionError,
  setCharacterAnchorFromBytes,
  setCharacterAnchorFromJob,
} from "../lib/reference-generation";
import { requireWorkspaceContext } from "./workspaces";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export function multipartReferenceSizeError(file: File): string | null {
  if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
    return `reference image exceeds ${MAX_REFERENCE_IMAGE_BYTES} bytes`;
  }
  return null;
}

function mapReferenceError(error: unknown): never {
  if (error instanceof ReferenceResolutionError) {
    throw new HttpError(error.httpStatus, {
      code: "validation_error",
      message: error.message,
    });
  }
  throw error;
}

async function loadOwnedCharacterRow(
  characterId: string,
  userId: string,
  workspaceId: string
) {
  const [row] = await db
    .select()
    .from(characters)
    .where(
      and(
        eq(characters.id, characterId),
        eq(characters.ownerUserId, userId),
        eq(characters.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!row) {
    throw new HttpError(404, {
      code: "not_found",
      message: "character not found",
    });
  }

  return row;
}

async function loadOwnedCharacterResponse(
  characterId: string,
  userId: string,
  workspaceId: string
) {
  return toCharacterResponse(
    await loadOwnedCharacterRow(characterId, userId, workspaceId)
  );
}

async function assertNewAnchorAllowed(
  characterId: string,
  userId: string,
  workspaceId: string
): Promise<void> {
  const character = await loadOwnedCharacterRow(
    characterId,
    userId,
    workspaceId
  );
  if (!character.referenceImageKey) {
    await assertAnchorCreationAllowed(db, workspaceId);
  }
}

export async function handleCharacterAnchorPost(
  request: Request,
  characterId: string
): Promise<Response> {
  const context = await requireWorkspaceContext(request);
  await assertNewAnchorAllowed(
    characterId,
    context.user.id,
    context.workspaceId
  );
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      throw new HttpError(400, {
        code: "validation_error",
        message: "multipart upload requires an image field",
      });
    }
    const sizeError = multipartReferenceSizeError(file);
    if (sizeError) {
      throw new HttpError(400, {
        code: "validation_error",
        message: sizeError,
      });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validated = validateReferenceImageBytes(
      bytes,
      file.type as "image/jpeg" | "image/png" | "image/webp" | undefined
    );
    if (!validated.ok) {
      throw new HttpError(400, {
        code: "validation_error",
        message: validated.error,
      });
    }

    await setCharacterAnchorFromBytes(
      db,
      context.user.id,
      characterId,
      validated.value.bytes,
      validated.value.mimeType,
      validated.value.ext
    ).catch(mapReferenceError);

    return json(
      await loadOwnedCharacterResponse(
        characterId,
        context.user.id,
        context.workspaceId
      )
    );
  }

  const body = await readJson<unknown>(request);

  const fromJob = setCharacterAnchorFromJobSchema.safeParse(body);
  if (fromJob.success) {
    await setCharacterAnchorFromJob(
      db,
      context.user.id,
      characterId,
      fromJob.data.fromJobId,
      fromJob.data.imageIndex ?? 0
    ).catch(mapReferenceError);

    return json(
      await loadOwnedCharacterResponse(
        characterId,
        context.user.id,
        context.workspaceId
      )
    );
  }

  const upload = setCharacterAnchorUploadSchema.safeParse(body);
  if (upload.success) {
    const parsed = parseReferenceDataUrl(upload.data.imageDataUrl);
    if (!parsed.ok) {
      throw new HttpError(400, {
        code: "validation_error",
        message: parsed.error,
      });
    }

    await setCharacterAnchorFromBytes(
      db,
      context.user.id,
      characterId,
      parsed.value.bytes,
      parsed.value.mimeType,
      parsed.value.ext
    ).catch(mapReferenceError);

    return json(
      await loadOwnedCharacterResponse(
        characterId,
        context.user.id,
        context.workspaceId
      )
    );
  }

  throw new HttpError(400, {
    code: "validation_error",
    message: "provide fromJobId, imageDataUrl, or multipart image upload",
  });
}

export async function handleCharacterAnchorDelete(
  request: Request,
  characterId: string
): Promise<Response> {
  const context = await requireWorkspaceContext(request);
  await loadOwnedCharacterRow(
    characterId,
    context.user.id,
    context.workspaceId
  );
  await clearCharacterAnchor(db, context.user.id, characterId).catch(
    mapReferenceError
  );
  return new Response(null, { status: 204 });
}
