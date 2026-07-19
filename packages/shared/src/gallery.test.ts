import { describe, expect, test } from "bun:test";
import {
  deriveRemixName,
  galleryDetailResponseSchema,
  galleryListResponseSchema,
  normalizeGalleryQuery,
} from "./gallery";

describe("gallery DTOs", () => {
  test("parses gallery list response", () => {
    const parsed = galleryListResponseSchema.safeParse({
      hasMore: false,
      items: [
        {
          coverImageUrl: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          id: "11111111-1111-4111-8111-111111111111",
          name: "Hero",
          owner: { displayName: "Ada" },
          themeId: "anime",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      nextOffset: 24,
    });
    expect(parsed.success).toBe(true);
  });

  test("parses gallery detail with remix lineage", () => {
    const parsed = galleryDetailResponseSchema.safeParse({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "11111111-1111-4111-8111-111111111111",
      isOwner: false,
      name: "Hero",
      owner: { displayName: "Ada" },
      remixCount: 2,
      remixedFrom: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Original",
      },
      renders: ["https://example.com/a.png"],
      spec: { meta: { name: "Hero" } },
      themeId: "anime",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("normalizeGalleryQuery", () => {
  test("trims whitespace", () => {
    expect(normalizeGalleryQuery("  gojo  ")).toBe("gojo");
  });

  test("returns null for empty input", () => {
    expect(normalizeGalleryQuery("")).toBeNull();
    expect(normalizeGalleryQuery("   ")).toBeNull();
    expect(normalizeGalleryQuery(null)).toBeNull();
  });

  test("caps length at 64 characters", () => {
    const long = "x".repeat(80);
    expect(normalizeGalleryQuery(long)?.length).toBe(64);
  });
});

describe("deriveRemixName", () => {
  test("prefixes non-empty names", () => {
    expect(deriveRemixName("Gojo")).toBe("Remix of Gojo");
  });

  test("falls back for blank names", () => {
    expect(deriveRemixName("   ")).toBe("Remix of Untitled");
  });

  test("caps length at 120 characters", () => {
    const long = "x".repeat(130);
    expect(deriveRemixName(long).length).toBe(120);
  });
});
