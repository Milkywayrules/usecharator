import { z } from "zod";

export const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;

export const REFERENCE_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type ReferenceImageMimeType =
  (typeof REFERENCE_IMAGE_MIME_TYPES)[number];

const DATA_URL_RE =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i;

export interface ValidatedReferenceImage {
  bytes: Uint8Array;
  ext: "jpg" | "png" | "webp";
  mimeType: ReferenceImageMimeType;
}

function extForMime(mimeType: ReferenceImageMimeType): "jpg" | "png" | "webp" {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}

function matchesMagicBytes(
  bytes: Uint8Array,
  mimeType: ReferenceImageMimeType
): boolean {
  if (bytes.length < 12) {
    return false;
  }
  switch (mimeType) {
    case "image/png":
      return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      );
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/webp":
      return (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    default:
      return false;
  }
}

function decodeBase64String(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const decoded = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    decoded[index] = binary.charCodeAt(index);
  }
  return decoded;
}

export function validateReferenceImageBytes(
  bytes: Uint8Array,
  declaredMimeType?: ReferenceImageMimeType
):
  | { error?: string; ok: true; value: ValidatedReferenceImage }
  | { error: string; ok: false } {
  if (bytes.length === 0) {
    return { error: "reference image is empty", ok: false };
  }
  if (bytes.length > MAX_REFERENCE_IMAGE_BYTES) {
    return {
      error: `reference image exceeds ${MAX_REFERENCE_IMAGE_BYTES} bytes`,
      ok: false,
    };
  }

  const mimeType =
    declaredMimeType ??
    REFERENCE_IMAGE_MIME_TYPES.find((candidate) =>
      matchesMagicBytes(bytes, candidate)
    );

  if (!(mimeType && matchesMagicBytes(bytes, mimeType))) {
    return { error: "reference image must be png, jpeg, or webp", ok: false };
  }

  return {
    ok: true,
    value: {
      bytes,
      ext: extForMime(mimeType),
      mimeType,
    },
  };
}

export function parseReferenceDataUrl(
  dataUrl: string
):
  | { error?: string; ok: true; value: ValidatedReferenceImage }
  | { error: string; ok: false } {
  const match = DATA_URL_RE.exec(dataUrl.trim());
  if (!(match?.[1] && match[2])) {
    return { error: "reference image data url is invalid", ok: false };
  }
  const mimeType = match[1].toLowerCase() as ReferenceImageMimeType;
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64String(match[2]);
  } catch {
    return { error: "reference image base64 is invalid", ok: false };
  }
  return validateReferenceImageBytes(bytes, mimeType);
}

export const referenceJobImageSchema = z.object({
  imageIndex: z.number().int().min(0).max(15).optional(),
  jobId: z.string().uuid(),
});

export type ReferenceJobImage = z.infer<typeof referenceJobImageSchema>;

export const setCharacterAnchorFromJobSchema = z.object({
  fromJobId: z.string().uuid(),
  imageIndex: z.number().int().min(0).max(15).optional(),
});

export const setCharacterAnchorUploadSchema = z.object({
  imageDataUrl: z
    .string()
    .min(1)
    .max(MAX_REFERENCE_IMAGE_BYTES * 2),
});

export const referenceStrengthSchema = z.number().min(0).max(1);
