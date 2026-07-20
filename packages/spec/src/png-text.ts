/** Hand-rolled PNG tEXt / zTXt chunk reader and writer (CCv3 card embedding). */

import { inflateSync } from "node:zlib";
import { MAX_ST_CARD_PNG_BYTES } from "./limits";

export { MAX_ST_CARD_PNG_BYTES } from "./limits";

export const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export const MAX_PNG_CHUNK_COUNT = 1024;
export const MAX_PNG_CHUNK_DATA_BYTES = 2 * 1024 * 1024;

export interface PngTextChunk {
  keyword: string;
  text: string;
}

export type PngTextErrorCode =
  | "invalid_signature"
  | "truncated"
  | "invalid_crc"
  | "oversized"
  | "too_many_chunks"
  | "chunk_data_oversized"
  | "unsupported_compression"
  | "invalid_text_encoding";

export class PngTextError extends Error {
  readonly code: PngTextErrorCode;

  constructor(code: PngTextErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "PngTextError";
  }
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

function readUint32Be(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function writeUint32Be(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, value >>> 0, false);
  return buf;
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

function bytesToLatin1(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]!);
  }
  return out;
}

function latin1ToBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code > 0xff) {
      throw new PngTextError(
        "invalid_text_encoding",
        "tEXt keyword/text must be Latin-1"
      );
    }
    out[i] = code;
  }
  return out;
}

function decodeTexKeywordAndText(data: Uint8Array): PngTextChunk {
  const nullIndex = data.indexOf(0);
  if (nullIndex < 0) {
    throw new PngTextError("truncated", "tEXt chunk missing null separator");
  }
  const keywordBytes = data.subarray(0, nullIndex);
  const textBytes = data.subarray(nullIndex + 1);
  if (keywordBytes.length === 0 || keywordBytes.length > 79) {
    throw new PngTextError(
      "invalid_text_encoding",
      "invalid tEXt keyword length"
    );
  }
  for (const byte of keywordBytes) {
    if (byte < 0x20 || byte > 0x7e) {
      throw new PngTextError(
        "invalid_text_encoding",
        "tEXt keyword must be printable Latin-1"
      );
    }
  }
  return {
    keyword: bytesToLatin1(keywordBytes),
    text: bytesToLatin1(textBytes),
  };
}

function decodeZtxtKeywordAndText(data: Uint8Array): PngTextChunk {
  const firstNull = data.indexOf(0);
  if (firstNull < 0) {
    throw new PngTextError(
      "truncated",
      "zTXt chunk missing keyword terminator"
    );
  }
  const keywordBytes = data.subarray(0, firstNull);
  const rest = data.subarray(firstNull + 1);
  if (rest.length < 2) {
    throw new PngTextError(
      "truncated",
      "zTXt chunk missing compression header"
    );
  }
  const compressionMethod = rest[0]!;
  if (compressionMethod !== 0) {
    throw new PngTextError(
      "unsupported_compression",
      "only deflate (method 0) zTXt chunks are supported"
    );
  }
  const compressed = rest.subarray(1);
  let inflated: Buffer;
  try {
    inflated = inflateSync(compressed);
  } catch {
    throw new PngTextError(
      "unsupported_compression",
      "zTXt chunk could not be decompressed"
    );
  }
  if (inflated.length > MAX_PNG_CHUNK_DATA_BYTES) {
    throw new PngTextError(
      "chunk_data_oversized",
      `decompressed zTXt exceeds ${MAX_PNG_CHUNK_DATA_BYTES} bytes`
    );
  }
  return {
    keyword: bytesToLatin1(keywordBytes),
    text: bytesToLatin1(new Uint8Array(inflated)),
  };
}

interface ParsedPngChunk {
  data: Uint8Array;
  type: string;
}

function parsePngChunks(bytes: Uint8Array): ParsedPngChunk[] {
  if (bytes.length < PNG_SIGNATURE.length + 12) {
    throw new PngTextError("truncated", "PNG file too short");
  }
  if (bytes.length > MAX_ST_CARD_PNG_BYTES) {
    throw new PngTextError(
      "oversized",
      `PNG exceeds ${MAX_ST_CARD_PNG_BYTES} bytes`
    );
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new PngTextError("invalid_signature", "invalid PNG signature");
    }
  }

  const chunks: ParsedPngChunk[] = [];
  let offset = PNG_SIGNATURE.length;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (offset < bytes.length) {
    if (chunks.length >= MAX_PNG_CHUNK_COUNT) {
      throw new PngTextError(
        "too_many_chunks",
        `PNG exceeds ${MAX_PNG_CHUNK_COUNT} chunks`
      );
    }
    if (offset + 12 > bytes.length) {
      throw new PngTextError("truncated", "truncated PNG chunk header");
    }
    const length = readUint32Be(view, offset);
    if (length > MAX_PNG_CHUNK_DATA_BYTES) {
      throw new PngTextError(
        "chunk_data_oversized",
        `chunk data exceeds ${MAX_PNG_CHUNK_DATA_BYTES} bytes`
      );
    }
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = bytesToLatin1(typeBytes);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcStart = dataEnd;
    const crcEnd = crcStart + 4;
    if (crcEnd > bytes.length) {
      throw new PngTextError("truncated", "truncated PNG chunk data or CRC");
    }
    const data = bytes.subarray(dataStart, dataEnd);
    const expectedCrc = readUint32Be(view, crcStart);
    const crcInput = concatChunks([typeBytes, data]);
    const actualCrc = crc32(crcInput);
    if (actualCrc !== expectedCrc) {
      throw new PngTextError("invalid_crc", `invalid CRC for ${type} chunk`);
    }
    chunks.push({ data, type });
    offset = crcEnd;
    if (type === "IEND") {
      if (offset !== bytes.length) {
        throw new PngTextError("truncated", "unexpected bytes after IEND");
      }
      break;
    }
  }

  if (chunks.length === 0 || chunks.at(-1)?.type !== "IEND") {
    throw new PngTextError("truncated", "PNG missing IEND chunk");
  }

  return chunks;
}

function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = latin1ToBytes(type);
  if (typeBytes.length !== 4) {
    throw new Error("PNG chunk type must be 4 bytes");
  }
  const length = writeUint32Be(data.length);
  const crc = writeUint32Be(crc32(concatChunks([typeBytes, data])));
  return concatChunks([length, typeBytes, data, crc]);
}

function buildTextChunk(keyword: string, text: string): Uint8Array {
  if (keyword.length === 0 || keyword.length > 79) {
    throw new PngTextError(
      "invalid_text_encoding",
      "invalid tEXt keyword length"
    );
  }
  const payload = concatChunks([
    latin1ToBytes(keyword),
    new Uint8Array([0]),
    latin1ToBytes(text),
  ]);
  if (payload.length > MAX_PNG_CHUNK_DATA_BYTES) {
    throw new PngTextError(
      "chunk_data_oversized",
      `tEXt payload exceeds ${MAX_PNG_CHUNK_DATA_BYTES} bytes`
    );
  }
  return buildChunk("tEXt", payload);
}

/** Read all tEXt and supported zTXt chunks from a PNG byte stream. */
export function readPngTextChunks(bytes: Uint8Array): PngTextChunk[] {
  const parsed = parsePngChunks(bytes);
  const textChunks: PngTextChunk[] = [];
  for (const chunk of parsed) {
    if (chunk.type === "tEXt") {
      textChunks.push(decodeTexKeywordAndText(chunk.data));
    } else if (chunk.type === "zTXt") {
      textChunks.push(decodeZtxtKeywordAndText(chunk.data));
    }
  }
  return textChunks;
}

/** Find the first tEXt/zTXt chunk matching `keyword` (e.g. ccv3, chara). */
export function readPngTextChunk(
  bytes: Uint8Array,
  keyword: string
): string | null {
  for (const chunk of readPngTextChunks(bytes)) {
    if (chunk.keyword === keyword) {
      return chunk.text;
    }
  }
  return null;
}

const REPLACEABLE_KEYWORDS = new Set(["ccv3", "chara"]);

/**
 * Insert or replace ccv3/chara tEXt chunks immediately before IEND.
 * Other chunks are preserved in order.
 */
export function embedPngTextChunks(
  pngBytes: Uint8Array,
  entries: PngTextChunk[]
): Uint8Array {
  const parsed = parsePngChunks(pngBytes);
  const rebuilt: Uint8Array[] = [PNG_SIGNATURE];

  for (const chunk of parsed) {
    if (chunk.type === "IEND") {
      break;
    }
    if (chunk.type !== "tEXt") {
      rebuilt.push(buildChunk(chunk.type, chunk.data));
      continue;
    }
    const { keyword } = decodeTexKeywordAndText(chunk.data);
    if (REPLACEABLE_KEYWORDS.has(keyword)) {
      continue;
    }
    rebuilt.push(buildChunk("tEXt", chunk.data));
  }

  for (const entry of entries) {
    rebuilt.push(buildTextChunk(entry.keyword, entry.text));
  }

  rebuilt.push(buildChunk("IEND", new Uint8Array(0)));
  return concatChunks(rebuilt);
}

/** Validate PNG structure without returning text payload. */
export function validatePngBytes(bytes: Uint8Array): void {
  parsePngChunks(bytes);
}
