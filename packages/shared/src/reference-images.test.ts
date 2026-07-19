import { describe, expect, test } from "bun:test";
import {
  MAX_REFERENCE_IMAGE_BYTES,
  parseReferenceDataUrl,
  validateReferenceImageBytes,
} from "./reference-images";

const PNG_HEADER = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

describe("reference image validation", () => {
  test("accepts valid png magic bytes", () => {
    const result = validateReferenceImageBytes(PNG_HEADER, "image/png");
    expect(result.ok).toBe(true);
  });

  test("rejects empty payload", () => {
    const result = validateReferenceImageBytes(new Uint8Array());
    expect(result.ok).toBe(false);
  });

  test("rejects oversize payload", () => {
    const bytes = new Uint8Array(MAX_REFERENCE_IMAGE_BYTES + 1);
    bytes.set(PNG_HEADER, 0);
    const result = validateReferenceImageBytes(bytes, "image/png");
    expect(result.ok).toBe(false);
  });

  test("parses data url", () => {
    const base64 = Buffer.from(PNG_HEADER).toString("base64");
    const parsed = parseReferenceDataUrl(`data:image/png;base64,${base64}`);
    expect(parsed.ok).toBe(true);
  });
});

describe("reference strength bounds", () => {
  test("schema enforces 0-1 via referenceStrengthSchema import site", async () => {
    const { referenceStrengthSchema } = await import("./reference-images");
    expect(referenceStrengthSchema.safeParse(0.5).success).toBe(true);
    expect(referenceStrengthSchema.safeParse(1.2).success).toBe(false);
  });
});
