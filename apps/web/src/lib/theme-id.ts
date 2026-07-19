import { THEME_IDS, type ThemeId } from "@charator/spec";

export function normalizeThemeId(
  themeId: string | ThemeId | null | undefined
): ThemeId | null | undefined {
  if (themeId === undefined) {
    return;
  }
  if (themeId === null) {
    return null;
  }
  if ((THEME_IDS as readonly string[]).includes(themeId)) {
    return themeId as ThemeId;
  }
  return null;
}

export function themeIdForRequest(themeId: ThemeId | null | undefined): {
  themeId?: ThemeId | null;
} {
  const normalized = normalizeThemeId(themeId);
  if (normalized === undefined) {
    return {};
  }
  return { themeId: normalized };
}
