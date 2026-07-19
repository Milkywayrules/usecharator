import {
  characterReports,
  characters,
  generationJobs,
  user,
} from "@charator/db";
import {
  normalizeGalleryQuery,
  reportCharacterRequestSchema,
  shouldHideCharacter,
} from "@charator/shared";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { db, resolveAuthUser } from "../auth";
import { config } from "../config";
import { signedUrlsForJob } from "../jobs/processor";
import { referenceImageUrlForKey } from "../lib/character-response";
import { hashReporterIp } from "../lib/crypto";
import { HttpError } from "../lib/errors";
import {
  clientIpFromHeaders,
  SlidingWindowRateLimiter,
} from "../lib/rate-limit";

const reportLimiter = new SlidingWindowRateLimiter(
  config.RATE_LIMIT_ANONYMOUS_PER_HOUR,
  60 * 60 * 1000
);

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;
const MAX_DETAIL_RENDERS = 24;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function coverUrlsByCharacterIds(
  characterIds: string[]
): Promise<Map<string, string | null>> {
  const covers = new Map<string, string | null>();
  if (characterIds.length === 0) {
    return covers;
  }

  const jobs = await db
    .select({
      characterId: generationJobs.characterId,
      createdAt: generationJobs.createdAt,
      imageKeys: generationJobs.imageKeys,
    })
    .from(generationJobs)
    .where(
      and(
        inArray(generationJobs.characterId, characterIds),
        eq(generationJobs.status, "succeeded")
      )
    )
    .orderBy(desc(generationJobs.createdAt));

  for (const job of jobs) {
    if (!job.characterId || covers.has(job.characterId)) {
      continue;
    }
    const [firstKey] = job.imageKeys;
    if (!firstKey) {
      covers.set(job.characterId, null);
      continue;
    }
    const [url] = signedUrlsForJob([firstKey]);
    covers.set(job.characterId, url ?? null);
  }

  return covers;
}

async function renderUrlsForCharacter(characterId: string): Promise<string[]> {
  const jobs = await db
    .select({ imageKeys: generationJobs.imageKeys })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.characterId, characterId),
        eq(generationJobs.status, "succeeded")
      )
    )
    .orderBy(desc(generationJobs.createdAt))
    .limit(MAX_DETAIL_RENDERS);

  const renders: string[] = [];
  for (const job of jobs) {
    for (const url of signedUrlsForJob(job.imageKeys)) {
      renders.push(url);
      if (renders.length >= MAX_DETAIL_RENDERS) {
        return renders;
      }
    }
  }
  return renders;
}

function escapeIlikePattern(raw: string): string {
  return raw.replace(/[%_\\]/g, (char) => `\\${char}`);
}

function parsePagination(request: Request): {
  limit: number;
  offset: number;
  q: string | null;
  theme: string | null;
} {
  const url = new URL(request.url);
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const limitRaw = Number(
    url.searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE)
  );
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_PAGE_SIZE)
  );
  const theme = url.searchParams.get("theme");
  const q = normalizeGalleryQuery(url.searchParams.get("q"));
  return {
    limit,
    offset,
    q,
    theme: theme?.trim() ? theme.trim() : null,
  };
}

export async function handleGalleryList(request: Request): Promise<Response> {
  const { limit, offset, q, theme } = parsePagination(request);
  const filters = [
    eq(characters.visibility, "public"),
    eq(characters.moderationStatus, "visible"),
  ];
  if (theme) {
    filters.push(eq(characters.themeId, theme));
  }
  if (q) {
    filters.push(ilike(characters.name, `%${escapeIlikePattern(q)}%`));
  }

  const rows = await db
    .select({
      createdAt: characters.createdAt,
      id: characters.id,
      name: characters.name,
      ownerDisplayName: user.name,
      themeId: characters.themeId,
      updatedAt: characters.updatedAt,
    })
    .from(characters)
    .innerJoin(user, eq(characters.ownerUserId, user.id))
    .where(and(...filters))
    .orderBy(desc(characters.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const covers = await coverUrlsByCharacterIds(page.map((row) => row.id));

  return json({
    hasMore,
    items: page.map((row) => ({
      coverImageUrl: covers.get(row.id) ?? null,
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      name: row.name,
      owner: {
        displayName: row.ownerDisplayName?.trim() || "Anonymous",
      },
      themeId: row.themeId,
      updatedAt: row.updatedAt.toISOString(),
    })),
    nextOffset: offset + page.length,
  });
}

export async function handleGalleryDetail(
  request: Request,
  characterId: string
): Promise<Response> {
  const authUser = await resolveAuthUser(request);

  const [row] = await db
    .select({
      createdAt: characters.createdAt,
      id: characters.id,
      moderationStatus: characters.moderationStatus,
      name: characters.name,
      ownerDisplayName: user.name,
      ownerUserId: characters.ownerUserId,
      referenceImageKey: characters.referenceImageKey,
      remixedFromCharacterId: characters.remixedFromCharacterId,
      spec: characters.spec,
      themeId: characters.themeId,
      updatedAt: characters.updatedAt,
      visibility: characters.visibility,
    })
    .from(characters)
    .innerJoin(user, eq(characters.ownerUserId, user.id))
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!row) {
    throw new HttpError(404, {
      code: "not_found",
      message: "character not found",
    });
  }

  const isOwner = authUser?.id === row.ownerUserId;
  if (row.visibility !== "public" && !isOwner) {
    throw new HttpError(404, {
      code: "not_found",
      message: "character not found",
    });
  }

  if (row.moderationStatus === "hidden" && !isOwner) {
    throw new HttpError(404, {
      code: "not_found",
      message: "character not found",
    });
  }

  let remixedFrom: { id: string; name: string } | null = null;
  if (row.remixedFromCharacterId) {
    const [source] = await db
      .select({
        id: characters.id,
        name: characters.name,
        visibility: characters.visibility,
      })
      .from(characters)
      .where(eq(characters.id, row.remixedFromCharacterId))
      .limit(1);

    if (source?.visibility === "public") {
      remixedFrom = { id: source.id, name: source.name };
    }
  }

  const [remixCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(characters)
    .where(eq(characters.remixedFromCharacterId, characterId));

  const renders = await renderUrlsForCharacter(characterId);

  return json({
    createdAt: row.createdAt.toISOString(),
    hiddenByModeration: isOwner && row.moderationStatus === "hidden",
    id: row.id,
    isOwner,
    name: row.name,
    owner: {
      displayName: row.ownerDisplayName?.trim() || "Anonymous",
    },
    referenceImageUrl: isOwner
      ? referenceImageUrlForKey(row.referenceImageKey)
      : null,
    remixCount: remixCountRow?.count ?? 0,
    remixedFrom,
    renders,
    spec: row.spec,
    themeId: row.themeId,
    updatedAt: row.updatedAt.toISOString(),
    ...(isOwner ? { visibility: row.visibility } : {}),
  });
}

export async function handleGalleryReport(
  request: Request,
  characterId: string
): Promise<Response> {
  const ip = clientIpFromHeaders(request.headers);
  const limit = reportLimiter.consume(`report:${ip}:${characterId}`);
  if (!limit.allowed) {
    throw new HttpError(429, {
      code: "rate_limited",
      message: "too many report requests",
    });
  }

  const parsed = reportCharacterRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "invalid request",
    });
  }

  const [character] = await db
    .select({
      id: characters.id,
      moderationStatus: characters.moderationStatus,
      visibility: characters.visibility,
    })
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (character?.visibility !== "public") {
    throw new HttpError(404, {
      code: "not_found",
      message: "character not found",
    });
  }

  const authUser = await resolveAuthUser(request);
  const reporterIpHash = authUser
    ? null
    : hashReporterIp(ip, config.KEY_ENCRYPTION_MASTER_KEY);

  const inserted = await db
    .insert(characterReports)
    .values({
      characterId,
      detail: parsed.data.detail ?? null,
      reason: parsed.data.reason,
      reporterIpHash,
      reporterUserId: authUser?.id ?? null,
    })
    .returning({ id: characterReports.id })
    .catch(() => null);

  if (!inserted?.[0]) {
    throw new HttpError(409, {
      code: "conflict",
      message: "you have already reported this character",
    });
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(characterReports)
    .where(eq(characterReports.characterId, characterId));

  const reportCount = countRow?.count ?? 0;
  let hidden = character.moderationStatus === "hidden";
  if (!hidden && shouldHideCharacter(reportCount)) {
    await db
      .update(characters)
      .set({ moderationStatus: "hidden", updatedAt: new Date() })
      .where(eq(characters.id, characterId));
    hidden = true;
  }

  return json(
    {
      hidden,
      reportId: inserted[0].id,
    },
    201
  );
}
