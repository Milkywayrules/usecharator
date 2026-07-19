import { S3Client } from "bun";
import { config, r2Configured, r2Endpoint } from "../config";
import { assertPublicHttpsUrl } from "./public-url";

let client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Configured(config)) {
    throw new Error("R2 is not configured");
  }
  if (!client) {
    client = new S3Client({
      accessKeyId: config.R2_ACCESS_KEY_ID,
      bucket: config.R2_BUCKET,
      endpoint: r2Endpoint(config),
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    });
  }
  return client;
}

export async function uploadGenerationImage(
  jobId: string,
  index: number,
  data: Uint8Array
): Promise<string> {
  const key = `generations/${jobId}/${index}.png`;
  const s3 = getR2Client();
  await s3.write(key, data, { type: "image/png" });
  return key;
}

export function presignedGetUrl(objectKey: string): string {
  const s3 = getR2Client();
  return s3.presign(objectKey, {
    expiresIn: config.PRESIGNED_URL_TTL_SECONDS,
  });
}

export async function fetchImageFromUrl(url: string): Promise<Uint8Array> {
  await assertPublicHttpsUrl(url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to download image (${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function fetchObjectBytes(objectKey: string): Promise<Uint8Array> {
  const s3 = getR2Client();
  return await s3.file(objectKey).bytes();
}

export async function deleteObject(objectKey: string): Promise<void> {
  const s3 = getR2Client();
  await s3.file(objectKey).delete();
}

export async function uploadAnchorImage(
  characterId: string,
  data: Uint8Array,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  ext: "jpg" | "png" | "webp"
): Promise<string> {
  const key = `anchors/${characterId}.${ext}`;
  const s3 = getR2Client();
  await s3.write(key, data, { type: mimeType });
  return key;
}

export async function copyGenerationImageToAnchor(
  sourceKey: string,
  characterId: string
): Promise<string> {
  const destKey = `anchors/${characterId}.png`;
  const s3 = getR2Client();
  const bytes = await s3.file(sourceKey).bytes();
  await s3.write(destKey, bytes, { type: "image/png" });
  return destKey;
}

export async function uploadJobReferenceImage(
  jobId: string,
  data: Uint8Array,
  mimeType: "image/jpeg" | "image/png" | "image/webp",
  ext: "jpg" | "png" | "webp"
): Promise<string> {
  const key = `generations/${jobId}/reference.${ext}`;
  const s3 = getR2Client();
  await s3.write(key, data, { type: mimeType });
  return key;
}
