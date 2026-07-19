import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  type GenerationJobResponse,
  generationJobResponseSchema,
} from "@charator/shared";
import { ApiClient } from "./client";
import type { ResolvedConfig } from "./config";

const TERMINAL_STATUSES = new Set(["succeeded", "failed"]);
const DEFAULT_OUTPUT_DIR = "./charator-output";
const POLL_INTERVAL_MS = 2000;

export async function pollJob(
  client: ApiClient,
  jobId: string,
  options?: { onStatus?: (job: GenerationJobResponse) => void }
): Promise<GenerationJobResponse> {
  for (;;) {
    const raw = await client.request<unknown>({
      auth: Boolean(client.config.token),
      path: `/generations/${jobId}`,
    });
    const parsed = generationJobResponseSchema.parse(raw);
    options?.onStatus?.(parsed);
    if (TERMINAL_STATUSES.has(parsed.status)) {
      return parsed;
    }
    await Bun.sleep(POLL_INTERVAL_MS);
  }
}

export async function downloadImages(
  urls: string[],
  outputDir: string
): Promise<string[]> {
  mkdirSync(outputDir, { recursive: true });
  const paths: string[] = [];
  for (let index = 0; index < urls.length; index++) {
    const url = urls[index];
    if (!url) {
      continue;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `failed to download image ${index + 1}: ${response.status}`
      );
    }
    const ext = guessExtension(response.headers.get("content-type"));
    const filePath = join(
      outputDir,
      `charator-${Date.now()}-${index + 1}.${ext}`
    );
    await Bun.write(filePath, response);
    paths.push(filePath);
  }
  return paths;
}

function guessExtension(contentType: string | null): string {
  if (!contentType) {
    return "png";
  }
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return "jpg";
  }
  if (contentType.includes("webp")) {
    return "webp";
  }
  return "png";
}

export async function waitAndDownloadJob(
  client: ApiClient,
  jobId: string,
  outputDir = DEFAULT_OUTPUT_DIR,
  onStatus?: (job: GenerationJobResponse) => void
): Promise<{ job: GenerationJobResponse; files: string[] }> {
  const job = await pollJob(client, jobId, { onStatus });
  if (job.status === "failed") {
    throw new Error(job.error ?? "generation failed");
  }
  const urls = job.imageUrls ?? [];
  const files = await downloadImages(urls, outputDir);
  return { files, job };
}

export function defaultOutputDir(): string {
  return DEFAULT_OUTPUT_DIR;
}

export function createClient(
  config: ResolvedConfig,
  fetchImpl?: typeof fetch
): ApiClient {
  return new ApiClient(config, fetchImpl);
}
