import { describe, expect, test } from "bun:test";
import { MAX_REFERENCE_IMAGE_BYTES } from "@charator/shared";
import { multipartReferenceSizeError } from "./anchor";

describe("multipartReferenceSizeError", () => {
  test("returns null when file is within limit", () => {
    const file = { size: MAX_REFERENCE_IMAGE_BYTES } as File;
    expect(multipartReferenceSizeError(file)).toBeNull();
  });

  test("returns error when file exceeds limit", () => {
    const file = { size: MAX_REFERENCE_IMAGE_BYTES + 1 } as File;
    expect(multipartReferenceSizeError(file)).toBe(
      `reference image exceeds ${MAX_REFERENCE_IMAGE_BYTES} bytes`
    );
  });
});
