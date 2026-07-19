import { describe, expect, test } from "bun:test";
import {
  canRemixCharacter,
  MODERATION_HIDE_THRESHOLD,
  shouldHideCharacter,
} from "./moderation";

describe("shouldHideCharacter", () => {
  test("does not hide below threshold", () => {
    expect(shouldHideCharacter(MODERATION_HIDE_THRESHOLD - 1)).toBe(false);
  });

  test("hides at threshold", () => {
    expect(shouldHideCharacter(MODERATION_HIDE_THRESHOLD)).toBe(true);
  });

  test("hides above threshold", () => {
    expect(shouldHideCharacter(MODERATION_HIDE_THRESHOLD + 3)).toBe(true);
  });
});

describe("canRemixCharacter", () => {
  const ownerUserId = "owner-1";
  const viewerUserId = "viewer-1";

  test("allows owners regardless of visibility or moderation", () => {
    expect(
      canRemixCharacter({
        moderationStatus: "hidden",
        ownerUserId,
        viewerUserId: ownerUserId,
        visibility: "private",
      })
    ).toBe(true);
  });

  test("allows non-owners for public visible characters", () => {
    expect(
      canRemixCharacter({
        moderationStatus: "visible",
        ownerUserId,
        viewerUserId,
        visibility: "public",
      })
    ).toBe(true);
  });

  test("blocks non-owners for moderation-hidden public characters", () => {
    expect(
      canRemixCharacter({
        moderationStatus: "hidden",
        ownerUserId,
        viewerUserId,
        visibility: "public",
      })
    ).toBe(false);
  });

  test("blocks non-owners for private characters", () => {
    expect(
      canRemixCharacter({
        moderationStatus: "visible",
        ownerUserId,
        viewerUserId,
        visibility: "private",
      })
    ).toBe(false);
  });
});
