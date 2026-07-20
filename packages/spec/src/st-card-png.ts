/** PNG-backed SillyTavern card import (Node/Bun only — not in client bundle). */

import { PNG_SIGNATURE, readPngTextChunk } from "./png-text";
import {
  type ImportStCardResult,
  importStCardEnvelope,
  type StCardSourceFormat,
} from "./st-card";
import { base64ToUtf8 } from "./base64";

function decodeBase64Json(text: string): unknown {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("{") ? trimmed : base64ToUtf8(trimmed);
  return JSON.parse(jsonText);
}

function parsePngCard(bytes: Uint8Array): {
  card: Record<string, unknown>;
  sourceFormat: StCardSourceFormat;
} {
  const ccv3Text = readPngTextChunk(bytes, "ccv3");
  if (ccv3Text) {
    return {
      card: decodeBase64Json(ccv3Text) as Record<string, unknown>,
      sourceFormat: "ccv3-png",
    };
  }
  const charaText = readPngTextChunk(bytes, "chara");
  if (charaText) {
    return {
      card: decodeBase64Json(charaText) as Record<string, unknown>,
      sourceFormat: "ccv2-png",
    };
  }
  throw new Error("PNG has no ccv3 or chara text chunk");
}

export function importStCardFromPng(bytes: Uint8Array): ImportStCardResult {
  const { card, sourceFormat } = parsePngCard(bytes);
  return importStCardEnvelope(card, sourceFormat);
}

export function isPngBytes(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) {
    return false;
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      return false;
    }
  }
  return true;
}
