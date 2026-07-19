import { characters } from "@charator/db";
import {
  parseReferenceDataUrl,
  setCharacterAnchorFromJobSchema,
  setCharacterAnchorUploadSchema,
  validateReferenceImageBytes,
} from "@charator/shared";
import { eq } from "drizzle-orm";
import { db, requireAuthUser } from "../auth";
import { toCharacterResponse } from "../lib/character-response";
import { HttpError } from "../lib/errors";
import {
  clearCharacterAnchor,
  ReferenceResolutionError,
  setCharacterAnchorFromBytes,
  setCharacterAnchorFromJob,
} from "../lib/reference-generation";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
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

async function loadOwnedCharacterResponse(characterId: string, userId: string) {
  const [row] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!row || row.ownerUserId !== userId) {
    throw new HttpError(404, {
      code: "not_found",
      message: "character not found",
    });
  }

  return toCharacterResponse(row);
}

export async function handleCharacterAnchorPost(
  request: Request,
  characterId: string
): Promise<Response> {
  const user = await requireAuthUser(request);
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
      user.id,
      characterId,
      validated.value.bytes,
      validated.value.mimeType,
      validated.value.ext
    ).catch(mapReferenceError);

    return json(await loadOwnedCharacterResponse(characterId, user.id));
  }

  const body = await readJson<unknown>(request);

  const fromJob = setCharacterAnchorFromJobSchema.safeParse(body);
  if (fromJob.success) {
    await setCharacterAnchorFromJob(
      db,
      user.id,
      characterId,
      fromJob.data.fromJobId,
      fromJob.data.imageIndex ?? 0
    ).catch(mapReferenceError);

    return json(await loadOwnedCharacterResponse(characterId, user.id));
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
      user.id,
      characterId,
      parsed.value.bytes,
      parsed.value.mimeType,
      parsed.value.ext
    ).catch(mapReferenceError);

    return json(await loadOwnedCharacterResponse(characterId, user.id));
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
  const user = await requireAuthUser(request);
  await clearCharacterAnchor(db, user.id, characterId).catch(mapReferenceError);
  return new Response(null, { status: 204 });
}
