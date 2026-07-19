import {
  MAX_REFERENCE_IMAGE_BYTES,
  validateReferenceImageBytes,
} from "@charator/shared";

export function validateReferenceFile(
  file: File
): { error?: string; ok: true } | { error: string; ok: false } {
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type)) {
    return {
      error: "reference image must be png, jpeg, or webp",
      ok: false,
    };
  }
  if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
    return {
      error: `reference image exceeds ${MAX_REFERENCE_IMAGE_BYTES} bytes`,
      ok: false,
    };
  }
  return { ok: true };
}

export async function fileToDataUrl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const validated = validateReferenceImageBytes(
    bytes,
    file.type as "image/jpeg" | "image/png" | "image/webp"
  );
  if (!validated.ok) {
    throw new Error(validated.error);
  }
  const base64 = btoa(String.fromCharCode(...bytes));
  return `data:${validated.value.mimeType};base64,${base64}`;
}
