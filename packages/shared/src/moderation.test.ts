import { describe, expect, test } from "bun:test";
import { MODERATION_HIDE_THRESHOLD, shouldHideCharacter } from "./moderation";

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
