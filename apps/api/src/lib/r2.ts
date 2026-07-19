import { S3Client } from "bun";
import { config, r2Configured, r2Endpoint } from "../config";

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
	data: Uint8Array,
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
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`failed to download image (${response.status})`);
	}
	return new Uint8Array(await response.arrayBuffer());
}

export { r2Configured } from "../config";
