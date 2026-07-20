import { describe, expect, test } from "bun:test";
import {
  embedPngTextChunks,
  MAX_ST_CARD_PNG_BYTES,
  PngTextError,
  readPngTextChunk,
  readPngTextChunks,
  validatePngBytes,
} from "../src/png-text";

/** Minimal valid 1×1 RGBA PNG (no text chunks). */
function minimalPng(): Uint8Array {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

describe("png-text codec", () => {
  test("reads and embeds ccv3 tEXt chunk", () => {
    const png = minimalPng();
    const payload = Buffer.from('{"spec":"chara_card_v3"}', "utf8").toString(
      "base64"
    );
    const embedded = embedPngTextChunks(png, [
      { keyword: "ccv3", text: payload },
    ]);
    expect(readPngTextChunk(embedded, "ccv3")).toBe(payload);
    validatePngBytes(embedded);
  });

  test("prefers ccv3 over chara when both present", () => {
    const png = embedPngTextChunks(minimalPng(), [
      { keyword: "ccv3", text: "Y2N2My1kYXRh" },
      { keyword: "chara", text: "Y2hhcmEtZGF0YQ==" },
    ]);
    const chunks = readPngTextChunks(png);
    expect(chunks.map((c) => c.keyword)).toEqual(["ccv3", "chara"]);
  });

  test("rejects invalid PNG signature", () => {
    const bad = minimalPng();
    bad[0] = 0x00;
    expect(() => validatePngBytes(bad)).toThrow(PngTextError);
    try {
      validatePngBytes(bad);
    } catch (error) {
      expect((error as PngTextError).code).toBe("invalid_signature");
    }
  });

  test("rejects truncated PNG", () => {
    const png = minimalPng().subarray(0, 20);
    expect(() => validatePngBytes(png)).toThrow(PngTextError);
  });

  test("rejects bad CRC", () => {
    const png = minimalPng();
    const corrupted = new Uint8Array(png);
    corrupted[corrupted.length - 2] ^= 0xff;
    expect(() => validatePngBytes(corrupted)).toThrow(PngTextError);
    try {
      validatePngBytes(corrupted);
    } catch (error) {
      expect((error as PngTextError).code).toBe("invalid_crc");
    }
  });

  test("rejects oversized PNG", () => {
    const oversized = new Uint8Array(MAX_ST_CARD_PNG_BYTES + 1);
    oversized.set(minimalPng(), 0);
    expect(() => validatePngBytes(oversized)).toThrow(PngTextError);
    try {
      validatePngBytes(oversized);
    } catch (error) {
      expect((error as PngTextError).code).toBe("oversized");
    }
  });

  test("replaces existing ccv3/chara chunks on embed", () => {
    const first = embedPngTextChunks(minimalPng(), [
      { keyword: "ccv3", text: "b2xk" },
    ]);
    const second = embedPngTextChunks(first, [
      { keyword: "ccv3", text: "bmV3" },
      { keyword: "chara", text: "dmwy" },
    ]);
    expect(readPngTextChunk(second, "ccv3")).toBe("bmV3");
    expect(readPngTextChunk(second, "chara")).toBe("dmwy");
    expect(
      readPngTextChunks(second).filter((c) => c.keyword === "ccv3")
    ).toHaveLength(1);
  });
});
