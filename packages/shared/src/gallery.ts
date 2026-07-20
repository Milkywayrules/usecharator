import { z } from "zod";
import { characterVisibilitySchema } from "./providers";

export const MAX_GALLERY_QUERY_LENGTH = 64;

/** Trim and cap gallery name search (`q`) for ILIKE contains matching. */
export function normalizeGalleryQuery(
  raw: string | null | undefined
): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, MAX_GALLERY_QUERY_LENGTH);
}

export const galleryListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(48).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  q: z.string().optional(),
  sort: z.enum(["recent", "most_remixed"]).optional(),
  theme: z.string().optional(),
});

export type GalleryListQuery = z.infer<typeof galleryListQuerySchema>;

export const gallerySortSchema = z.enum(["recent", "most_remixed"]);
export type GallerySort = z.infer<typeof gallerySortSchema>;

export const galleryOwnerSchema = z.object({
  displayName: z.string(),
});

export type GalleryOwner = z.infer<typeof galleryOwnerSchema>;

export const galleryListItemSchema = z.object({
  coverImageUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
  name: z.string(),
  owner: galleryOwnerSchema,
  remixCount: z.number().int().nonnegative().optional(),
  themeId: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export type GalleryListItem = z.infer<typeof galleryListItemSchema>;

export const galleryListResponseSchema = z.object({
  hasMore: z.boolean(),
  items: z.array(galleryListItemSchema),
  nextOffset: z.number().int().nonnegative(),
});

export type GalleryListResponse = z.infer<typeof galleryListResponseSchema>;

export const galleryRemixLineageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export type GalleryRemixLineage = z.infer<typeof galleryRemixLineageSchema>;

export const galleryDetailResponseSchema = z.object({
  createdAt: z.string().datetime(),
  hiddenByModeration: z.boolean().optional(),
  id: z.string().uuid(),
  isOwner: z.boolean(),
  name: z.string(),
  owner: galleryOwnerSchema,
  referenceImageUrl: z.string().url().nullable().optional(),
  remixCount: z.number().int().nonnegative(),
  remixedFrom: galleryRemixLineageSchema.nullable(),
  renders: z.array(z.string().url()),
  spec: z.unknown(),
  themeId: z.string().nullable(),
  updatedAt: z.string().datetime(),
  visibility: characterVisibilitySchema.optional(),
});

export type GalleryDetailResponse = z.infer<typeof galleryDetailResponseSchema>;

export const galleryParentUnavailableSchema = z.object({
  unavailable: z.literal(true),
});

export type GalleryParentUnavailable = z.infer<
  typeof galleryParentUnavailableSchema
>;

export const galleryLineageParentSchema = z.union([
  galleryListItemSchema,
  galleryParentUnavailableSchema,
]);

export type GalleryLineageParent = z.infer<typeof galleryLineageParentSchema>;

export const galleryLineageChildrenSchema = z.object({
  items: z.array(galleryListItemSchema),
  page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});

export type GalleryLineageChildren = z.infer<
  typeof galleryLineageChildrenSchema
>;

export const galleryLineageResponseSchema = z.object({
  ancestors: z.array(galleryListItemSchema),
  children: galleryLineageChildrenSchema,
  depthCapped: z.boolean(),
  parent: galleryLineageParentSchema.nullable(),
});

export type GalleryLineageResponse = z.infer<
  typeof galleryLineageResponseSchema
>;

export const gallerySpecDiffCharacterSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export type GallerySpecDiffCharacter = z.infer<
  typeof gallerySpecDiffCharacterSchema
>;

export const gallerySpecDiffChangeSchema = z.object({
  from: z.union([z.string(), z.boolean(), z.array(z.string()), z.null()]),
  path: z.string(),
  to: z.union([z.string(), z.boolean(), z.array(z.string()), z.null()]),
});

export const gallerySpecDiffSectionSchema = z.object({
  changes: z.array(gallerySpecDiffChangeSchema),
  sectionKey: z.string(),
  title: z.string(),
});

export const gallerySpecDiffResponseSchema = z.object({
  character: gallerySpecDiffCharacterSchema,
  other: gallerySpecDiffCharacterSchema,
  sections: z.array(gallerySpecDiffSectionSchema),
});

export type GallerySpecDiffResponse = z.infer<
  typeof gallerySpecDiffResponseSchema
>;

const REMIX_NAME_PREFIX = "Remix of ";
const MAX_CHARACTER_NAME_LENGTH = 120;

/** Derive a remix character name from the source name (length-capped). */
export function deriveRemixName(sourceName: string): string {
  const base = sourceName.trim() || "Untitled";
  const candidate = `${REMIX_NAME_PREFIX}${base}`;
  if (candidate.length <= MAX_CHARACTER_NAME_LENGTH) {
    return candidate;
  }
  return candidate.slice(0, MAX_CHARACTER_NAME_LENGTH);
}
