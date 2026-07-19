import { describe, expect, test } from "bun:test";
import { assertSheetUseAnchorSupported } from "./sheets";

const USE_ANCHOR_REQUIRES_REF_MODEL =
  /useAnchor requires a reference-capable model/;

describe("assertSheetUseAnchorSupported", () => {
  test("allows useAnchor on reference-capable models", () => {
    expect(() =>
      assertSheetUseAnchorSupported(true, "openai", "gpt-image-1")
    ).not.toThrow();
  });

  test("rejects useAnchor on non-reference models", () => {
    expect(() =>
      assertSheetUseAnchorSupported(true, "custom", "dall-e-3")
    ).toThrow(USE_ANCHOR_REQUIRES_REF_MODEL);
  });

  test("ignores useAnchor when false or omitted", () => {
    expect(() =>
      assertSheetUseAnchorSupported(false, "custom", "dall-e-3")
    ).not.toThrow();
    expect(() =>
      assertSheetUseAnchorSupported(undefined, "custom", "dall-e-3")
    ).not.toThrow();
  });
});
