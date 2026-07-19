import type { characters } from "@charator/db";
import { presignedGetUrl } from "./r2";

type CharacterRow = typeof characters.$inferSelect;

export function referenceImageUrlForKey(
  referenceImageKey: string | null | undefined
): string | null {
  if (!referenceImageKey) {
    return null;
  }
  try {
    return presignedGetUrl(referenceImageKey);
  } catch {
    return null;
  }
}

export function toCharacterResponse(row: CharacterRow) {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    moderationStatus: row.moderationStatus,
    name: row.name,
    referenceImageUrl: referenceImageUrlForKey(row.referenceImageKey),
    spec: row.spec,
    themeId: row.themeId,
    updatedAt: row.updatedAt.toISOString(),
    visibility: row.visibility,
  };
}
