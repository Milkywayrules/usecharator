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
import { diffSpecs, parseCharacterSpec } from "@charator/spec";
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
const LINEAGE_CHILDREN_PAGE_SIZE = 12;
const MAX_LINEAGE_DEPTH = 4;

type GallerySort = "most_remixed" | "recent";

interface GalleryCardRow {
  createdAt: Date;
  id: string;
  name: string;
  ownerDisplayName: string | null;
  remixCount: number;
  themeId: string | null;
  updatedAt: Date;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function isPublicVisible(input: {
  moderationStatus: string;
  visibility: string;
}): boolean {
  return input.visibility === "public" && input.moderationStatus === "visible";
}

const publicVisibleFilters = [
  eq(characters.visibility, "public"),
  eq(characters.moderationStatus, "visible"),
];

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

function mapRowsToGalleryCards(
  rows: GalleryCardRow[],
  covers: Map<string, string | null>
) {
  return rows.map((row) => ({
    coverImageUrl: covers.get(row.id) ?? null,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    name: row.name,
    owner: {
      displayName: row.ownerDisplayName?.trim() || "Anonymous",
    },
    remixCount: row.remixCount,
    themeId: row.themeId,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function galleryCardsForRows(
  rows: GalleryCardRow[]
): Promise<ReturnType<typeof mapRowsToGalleryCards>> {
  const covers = await coverUrlsByCharacterIds(rows.map((row) => row.id));
  return mapRowsToGalleryCards(rows, covers);
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
  sort: GallerySort;
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
  const sortParam = url.searchParams.get("sort");
  const sort: GallerySort =
    sortParam === "most_remixed" ? "most_remixed" : "recent";
  return {
    limit,
    offset,
    q,
    sort,
    theme: theme?.trim() ? theme.trim() : null,
  };
}

function parseLineagePagination(request: Request): {
  limit: number;
  offset: number;
  page: number;
} {
  const url = new URL(request.url);
  const pageRaw = Number(url.searchParams.get("page") ?? "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = LINEAGE_CHILDREN_PAGE_SIZE;
  return {
    limit,
    offset: (page - 1) * limit,
    page,
  };
}

const visibleRemixCountSubquery = sql<number>`(
  SELECT COUNT(*)::int
  FROM characters AS remix_children
  WHERE remix_children.remixed_from_character_id = ${characters.id}
    AND remix_children.visibility = 'public'
    AND remix_children.moderation_status = 'visible'
)`;

async function assertPublicGalleryCharacter(
  request: Request,
  characterId: string
): Promise<{
  id: string;
  moderationStatus: string;
  ownerUserId: string;
  remixedFromCharacterId: string | null;
  spec: unknown;
  visibility: string;
}> {
  const authUser = await resolveAuthUser(request);

  const [row] = await db
    .select({
      id: characters.id,
      moderationStatus: characters.moderationStatus,
      ownerUserId: characters.ownerUserId,
      remixedFromCharacterId: characters.remixedFromCharacterId,
      spec: characters.spec,
      visibility: characters.visibility,
    })
    .from(characters)
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

  return row;
}

export async function handleGalleryList(request: Request): Promise<Response> {
  const { limit, offset, q, sort, theme } = parsePagination(request);
  const filters = [...publicVisibleFilters];
  if (theme) {
    filters.push(eq(characters.themeId, theme));
  }
  if (q) {
    filters.push(ilike(characters.name, `%${escapeIlikePattern(q)}%`));
  }

  const query = db
    .select({
      createdAt: characters.createdAt,
      id: characters.id,
      name: characters.name,
      ownerDisplayName: user.name,
      remixCount: visibleRemixCountSubquery,
      themeId: characters.themeId,
      updatedAt: characters.updatedAt,
    })
    .from(characters)
    .innerJoin(user, eq(characters.ownerUserId, user.id))
    .where(and(...filters));

  const rows = await (sort === "most_remixed"
    ? query
        .orderBy(desc(visibleRemixCountSubquery), desc(characters.createdAt))
        .limit(limit + 1)
        .offset(offset)
    : query
        .orderBy(desc(characters.createdAt))
        .limit(limit + 1)
        .offset(offset));

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = await galleryCardsForRows(page);

  return json({
    hasMore,
    items,
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
        moderationStatus: characters.moderationStatus,
        name: characters.name,
        visibility: characters.visibility,
      })
      .from(characters)
      .where(eq(characters.id, row.remixedFromCharacterId))
      .limit(1);

    if (source && isPublicVisible(source)) {
      remixedFrom = { id: source.id, name: source.name };
    }
  }

  const [remixCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(characters)
    .where(
      and(
        eq(characters.remixedFromCharacterId, characterId),
        ...publicVisibleFilters
      )
    );

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

async function fetchLineageCharacterRow(characterId: string): Promise<
  | (GalleryCardRow & {
      moderationStatus: string;
      remixedFromCharacterId: string | null;
      visibility: string;
    })
  | null
> {
  const [row] = await db
    .select({
      createdAt: characters.createdAt,
      id: characters.id,
      moderationStatus: characters.moderationStatus,
      name: characters.name,
      ownerDisplayName: user.name,
      remixCount: visibleRemixCountSubquery,
      remixedFromCharacterId: characters.remixedFromCharacterId,
      themeId: characters.themeId,
      updatedAt: characters.updatedAt,
      visibility: characters.visibility,
    })
    .from(characters)
    .innerJoin(user, eq(characters.ownerUserId, user.id))
    .where(eq(characters.id, characterId))
    .limit(1);

  return row ?? null;
}

async function collectVisibleAncestors(startId: string | null): Promise<{
  ancestorRows: GalleryCardRow[];
  depthCapped: boolean;
}> {
  const ancestorRows: GalleryCardRow[] = [];
  let currentId = startId;
  let walked = 0;
  let depthCapped = false;

  while (currentId && walked < MAX_LINEAGE_DEPTH) {
    // biome-ignore lint/performance/noAwaitInLoops: remix lineage must be resolved in parent order
    const row = await fetchLineageCharacterRow(currentId);
    if (!(row && isPublicVisible(row))) {
      break;
    }

    ancestorRows.unshift(row);
    currentId = row.remixedFromCharacterId;
    walked += 1;

    if (currentId && walked >= MAX_LINEAGE_DEPTH) {
      const beyond = await fetchLineageCharacterRow(currentId);
      depthCapped = Boolean(beyond);
    }
  }

  return { ancestorRows, depthCapped };
}

async function resolveLineageParent(remixedFromCharacterId: string): Promise<{
  ancestors: Awaited<ReturnType<typeof galleryCardsForRows>>;
  depthCapped: boolean;
  parent:
    | Awaited<ReturnType<typeof galleryCardsForRows>>[number]
    | { unavailable: true }
    | null;
}> {
  const parentRow = await fetchLineageCharacterRow(remixedFromCharacterId);
  if (!parentRow) {
    return { ancestors: [], depthCapped: false, parent: null };
  }

  if (!isPublicVisible(parentRow)) {
    return { ancestors: [], depthCapped: false, parent: { unavailable: true } };
  }

  const [parentCard] = await galleryCardsForRows([parentRow]);
  const { ancestorRows, depthCapped } = await collectVisibleAncestors(
    parentRow.remixedFromCharacterId
  );
  const ancestors = await galleryCardsForRows(ancestorRows);

  return {
    ancestors,
    depthCapped,
    parent: parentCard ?? null,
  };
}

async function fetchVisibleRemixChildren(
  characterId: string,
  limit: number,
  offset: number
): Promise<{
  items: Awaited<ReturnType<typeof galleryCardsForRows>>;
  total: number;
}> {
  const childFilters = [
    eq(characters.remixedFromCharacterId, characterId),
    ...publicVisibleFilters,
  ];

  const [countRow, childRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(characters)
      .where(and(...childFilters)),
    db
      .select({
        createdAt: characters.createdAt,
        id: characters.id,
        name: characters.name,
        ownerDisplayName: user.name,
        remixCount: visibleRemixCountSubquery,
        themeId: characters.themeId,
        updatedAt: characters.updatedAt,
      })
      .from(characters)
      .innerJoin(user, eq(characters.ownerUserId, user.id))
      .where(and(...childFilters))
      .orderBy(desc(characters.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const items = await galleryCardsForRows(childRows);
  return { items, total: countRow[0]?.count ?? 0 };
}

export async function handleGalleryLineage(
  request: Request,
  characterId: string
): Promise<Response> {
  await assertPublicGalleryCharacter(request, characterId);
  const { limit, offset, page } = parseLineagePagination(request);

  const [current, children] = await Promise.all([
    db
      .select({
        remixedFromCharacterId: characters.remixedFromCharacterId,
      })
      .from(characters)
      .where(eq(characters.id, characterId))
      .limit(1),
    fetchVisibleRemixChildren(characterId, limit, offset),
  ]);

  let parent:
    | Awaited<ReturnType<typeof galleryCardsForRows>>[number]
    | { unavailable: true }
    | null = null;
  let ancestors: Awaited<ReturnType<typeof galleryCardsForRows>> = [];
  let depthCapped = false;

  if (current[0]?.remixedFromCharacterId) {
    ({ ancestors, depthCapped, parent } = await resolveLineageParent(
      current[0].remixedFromCharacterId
    ));
  }

  return json({
    ancestors,
    children: {
      items: children.items,
      page,
      total: children.total,
    },
    depthCapped,
    parent,
  });
}

export async function handleGallerySpecDiff(
  request: Request,
  characterId: string
): Promise<Response> {
  const url = new URL(request.url);
  const otherId = url.searchParams.get("other")?.trim();
  if (!otherId) {
    throw new HttpError(400, {
      code: "validation_error",
      message: "other query parameter is required",
    });
  }

  const [currentRow, otherRow] = await Promise.all([
    assertPublicGalleryCharacter(request, characterId).then(async (row) => {
      if (!isPublicVisible(row)) {
        throw new HttpError(404, {
          code: "not_found",
          message: "character not found",
        });
      }
      const [detail] = await db
        .select({ name: characters.name, spec: characters.spec })
        .from(characters)
        .where(eq(characters.id, characterId))
        .limit(1);
      return { id: row.id, name: detail?.name ?? "", spec: detail?.spec };
    }),
    assertPublicGalleryCharacter(request, otherId).then(async (row) => {
      if (!isPublicVisible(row)) {
        throw new HttpError(404, {
          code: "not_found",
          message: "character not found",
        });
      }
      const [detail] = await db
        .select({ name: characters.name, spec: characters.spec })
        .from(characters)
        .where(eq(characters.id, otherId))
        .limit(1);
      return { id: row.id, name: detail?.name ?? "", spec: detail?.spec };
    }),
  ]);

  const otherSpec = parseCharacterSpec(otherRow.spec);
  const currentSpec = parseCharacterSpec(currentRow.spec);
  const diff = diffSpecs(otherSpec, currentSpec);

  return json({
    character: { id: currentRow.id, name: currentRow.name },
    other: { id: otherRow.id, name: otherRow.name },
    sections: diff.sections,
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
