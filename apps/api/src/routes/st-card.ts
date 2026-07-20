import { characters, generationJobs } from "@charator/db";
import { MAX_REFERENCE_IMAGE_BYTES } from "@charator/shared";
import {
  encodeStCardChunks,
  exportStCard,
  importStCardFromJson,
  MAX_ST_CARD_PNG_BYTES,
  parseCharacterSpec,
  THEME_IDS,
  type ThemeId,
} from "@charator/spec";
import { embedPngTextChunks } from "@charator/spec/png-text";
import { importStCardFromPng, isPngBytes } from "@charator/spec/st-card-png";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../auth";
import { HttpError } from "../lib/errors";
import { fetchObjectBytes } from "../lib/r2";
import { requireWorkspaceContext } from "./workspaces";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function readJsonBody(
  request: Request,
  maxBytes: number
): Promise<unknown> {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isFinite(contentLength) || contentLength < 0) {
      throw new HttpError(400, {
        code: "validation_error",
        message: "invalid Content-Length header",
      });
    }
    if (contentLength > maxBytes) {
      throw new HttpError(413, {
        code: "payload_too_large",
        message: `request body exceeds ${maxBytes} bytes`,
      });
    }
  }

  const raw = await request.arrayBuffer();
  if (raw.byteLength > maxBytes) {
    throw new HttpError(413, {
      code: "payload_too_large",
      message: `request body exceeds ${maxBytes} bytes`,
    });
  }

  if (raw.byteLength === 0) {
    throw new HttpError(400, {
      code: "validation_error",
      message: "request body required",
    });
  }

  try {
    return JSON.parse(Buffer.from(raw).toString("utf8"));
  } catch {
    // biome-ignore lint/style/useErrorCause: HttpError is a typed API boundary, not a wrapper
    throw new HttpError(400, {
      code: "validation_error",
      message: "invalid JSON body",
    });
  }
}

function normalizeThemeId(value: unknown): ThemeId | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return THEME_IDS.includes(value as ThemeId) ? (value as ThemeId) : null;
}

async function loadOwnedCharacter(
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

async function latestRenderPngBytes(
  characterId: string
): Promise<Uint8Array | null> {
  const [job] = await db
    .select({ imageKeys: generationJobs.imageKeys })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.characterId, characterId),
        eq(generationJobs.status, "succeeded")
      )
    )
    .orderBy(desc(generationJobs.createdAt))
    .limit(1);

  const [firstKey] = job?.imageKeys ?? [];
  if (!firstKey) {
    return null;
  }

  try {
    return await fetchObjectBytes(firstKey);
  } catch {
    return null;
  }
}

/** Public import — mirrors `/spec/render` auth posture (no session required). */
export async function handleStCardImport(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let formData: Awaited<ReturnType<Request["formData"]>>;
    try {
      formData = await request.formData();
    } catch {
      // biome-ignore lint/style/useErrorCause: HttpError is a typed API boundary, not a wrapper
      throw new HttpError(400, {
        code: "validation_error",
        message: "invalid multipart form",
      });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, {
        code: "validation_error",
        message: "multipart field `file` is required",
      });
    }
    if (file.size > MAX_ST_CARD_PNG_BYTES) {
      throw new HttpError(400, {
        code: "validation_error",
        message: `file exceeds ${MAX_ST_CARD_PNG_BYTES} bytes`,
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    return json(importFromBytes(bytes, file.name));
  }

  const body = await readJsonBody(request, MAX_ST_CARD_PNG_BYTES);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, {
      code: "validation_error",
      message: "request body must be a JSON object",
    });
  }

  const record = body as Record<string, unknown>;

  if (typeof record.base64 === "string") {
    const bytes = Buffer.from(record.base64, "base64");
    if (bytes.length > MAX_ST_CARD_PNG_BYTES) {
      throw new HttpError(400, {
        code: "validation_error",
        message: `payload exceeds ${MAX_ST_CARD_PNG_BYTES} bytes`,
      });
    }
    const filename =
      typeof record.filename === "string" ? record.filename : undefined;
    return json(importFromBytes(new Uint8Array(bytes), filename));
  }

  if (record.card !== undefined) {
    const result = importStCardFromJson(record.card);
    return json(formatImportResponse(result));
  }

  const result = importStCardFromJson(body);
  return json(formatImportResponse(result));
}

function importFromBytes(bytes: Uint8Array, filename?: string) {
  const looksLikePng =
    isPngBytes(bytes) || (filename?.toLowerCase().endsWith(".png") ?? false);

  if (looksLikePng) {
    try {
      const result = importStCardFromPng(bytes);
      return formatImportResponse(result);
    } catch (error) {
      throw mapImportError(error);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    // biome-ignore lint/style/useErrorCause: HttpError is a typed API boundary, not a wrapper
    throw new HttpError(400, {
      code: "validation_error",
      message: "file is not a PNG or JSON character card",
    });
  }

  try {
    return formatImportResponse(importStCardFromJson(parsed));
  } catch (error) {
    throw mapImportError(error);
  }
}

function formatImportResponse(result: ReturnType<typeof importStCardFromJson>) {
  return {
    lossyFields: result.lossyFields,
    reviewRequired: result.reviewRequired,
    sourceFormat: result.sourceFormat,
    spec: result.spec,
  };
}

function mapImportError(error: unknown): never {
  if (error instanceof HttpError) {
    throw error;
  }
  const message =
    error instanceof Error ? error.message : "could not import character card";
  throw new HttpError(400, {
    code: "validation_error",
    message,
  });
}

export async function handleStCardExport(
  request: Request,
  characterId: string
): Promise<Response> {
  const context = await requireWorkspaceContext(request);
  const row = await loadOwnedCharacter(
    characterId,
    context.user.id,
    context.workspaceId
  );

  const spec = parseCharacterSpec(row.spec);
  const themeId = normalizeThemeId(row.themeId);
  const exported = exportStCard(spec, themeId, {
    creator: context.user.name ?? "",
  });

  const renderBytes = await latestRenderPngBytes(characterId);
  if (!renderBytes) {
    return json({
      card: exported.ccv3,
      format: "json" as const,
      message:
        "No render image found for this character — exported JSON card only.",
    });
  }

  if (renderBytes.length > MAX_REFERENCE_IMAGE_BYTES) {
    throw new HttpError(400, {
      code: "validation_error",
      message: "latest render image exceeds export size limit",
    });
  }

  let pngBytes: Uint8Array;
  try {
    pngBytes = embedPngTextChunks(
      renderBytes,
      encodeStCardChunks(exported.ccv3, exported.v2)
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "could not embed card into PNG";
    // biome-ignore lint/style/useErrorCause: HttpError is a typed API boundary, not a wrapper
    throw new HttpError(400, {
      code: "validation_error",
      message,
    });
  }

  const safeName = (row.name.trim() || "character")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return new Response(Buffer.from(pngBytes), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${safeName || "character"}-st-card.png"`,
      "Content-Type": "image/png",
      "X-St-Card-Format": "png",
    },
  });
}
