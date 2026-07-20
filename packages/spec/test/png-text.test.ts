import { describe, expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import {
  embedPngTextChunks,
  MAX_PNG_CHUNK_DATA_BYTES,
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

function latin1ToBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    out[i] = text.charCodeAt(i);
  }
  return out;
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xff_ff_ff_ff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = latin1ToBytes(type);
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length, false);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(
    0,
    crc32(concatChunks([typeBytes, data])),
    false
  );
  return concatChunks([length, typeBytes, data, crc]);
}

function insertTexChunkBeforeIend(
  pngBytes: Uint8Array,
  keyword: string,
  text: string
): Uint8Array {
  const iendMarker = latin1ToBytes("IEND");
  let iendIndex = -1;
  for (let i = 0; i <= pngBytes.length - 4; i += 1) {
    if (
      pngBytes[i] === iendMarker[0] &&
      pngBytes[i + 1] === iendMarker[1] &&
      pngBytes[i + 2] === iendMarker[2] &&
      pngBytes[i + 3] === iendMarker[3]
    ) {
      iendIndex = i - 4;
      break;
    }
  }
  if (iendIndex < 8) {
    throw new Error("IEND chunk not found");
  }

  const payload = concatChunks([
    latin1ToBytes(keyword),
    new Uint8Array([0]),
    latin1ToBytes(text),
  ]);
  const chunk = buildChunk("tEXt", payload);
  return concatChunks([
    pngBytes.subarray(0, iendIndex),
    chunk,
    pngBytes.subarray(iendIndex),
  ]);
}

function embedZtxtChunk(
  pngBytes: Uint8Array,
  keyword: string,
  compressed: Uint8Array
): Uint8Array {
  const iendMarker = latin1ToBytes("IEND");
  let iendIndex = -1;
  for (let i = 0; i <= pngBytes.length - 4; i += 1) {
    if (
      pngBytes[i] === iendMarker[0] &&
      pngBytes[i + 1] === iendMarker[1] &&
      pngBytes[i + 2] === iendMarker[2] &&
      pngBytes[i + 3] === iendMarker[3]
    ) {
      iendIndex = i - 4;
      break;
    }
  }
  if (iendIndex < 8) {
    throw new Error("IEND chunk not found");
  }

  const payload = concatChunks([
    latin1ToBytes(keyword),
    new Uint8Array([0, 0]),
    compressed,
  ]);
  const chunk = buildChunk("zTXt", payload);
  return concatChunks([
    pngBytes.subarray(0, iendIndex),
    chunk,
    pngBytes.subarray(iendIndex),
  ]);
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

  test("first ccv3/chara chunk wins when duplicate text chunks appear", () => {
    const embedded = embedPngTextChunks(minimalPng(), [
      { keyword: "ccv3", text: "first" },
    ]);
    const withDuplicate = insertTexChunkBeforeIend(embedded, "ccv3", "second");
    expect(readPngTextChunk(withDuplicate, "ccv3")).toBe("first");
    expect(
      readPngTextChunks(withDuplicate).filter((c) => c.keyword === "ccv3")
    ).toHaveLength(1);
  });

  test("rejects zTXt decompression bomb", () => {
    const expanded = Buffer.alloc(MAX_PNG_CHUNK_DATA_BYTES + 1, 0x41);
    const compressed = deflateSync(expanded);
    const png = embedZtxtChunk(minimalPng(), "ccv3", compressed);
    expect(() => readPngTextChunks(png)).toThrow(PngTextError);
    try {
      readPngTextChunks(png);
    } catch (error) {
      expect((error as PngTextError).code).toBe("chunk_data_oversized");
    }
  });
});
