import type { App } from "@charator/api/src/index";
import {
  type CharacterResponse,
  type CreateGenerationRequest,
  type CreateGenerationResponse,
  type CreateProviderKeyRequest,
  characterResponseSchema,
  createGenerationResponseSchema,
  type GenerationJobResponse,
  generationJobResponseSchema,
  type ProviderKeyResponse,
  providerKeyResponseSchema,
} from "@charator/shared";
import { treaty } from "@elysiajs/eden";

function resolveBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
}

const client = treaty<App>(resolveBaseUrl());

async function parseJson<T>(
  response: Response,
  schema: { parse: (input: unknown) => T }
): Promise<T> {
  const json: unknown = await response.json();
  return schema.parse(json);
}

async function readTreatyData<T>(
  result: { data: unknown; error: unknown },
  schema: { parse: (input: unknown) => T }
): Promise<T> {
  if (result.error) {
    throw result.error;
  }
  if (result.data instanceof Response) {
    if (!result.data.ok) {
      const body: unknown = await result.data.json().catch(() => null);
      const message =
        typeof body === "object" &&
        body !== null &&
        "message" in body &&
        typeof body.message === "string"
          ? body.message
          : `Request failed (${result.data.status})`;
      throw new Error(message);
    }
    return parseJson(result.data, schema);
  }
  return schema.parse(result.data);
}

export async function getGenerationJob(
  id: string
): Promise<GenerationJobResponse> {
  return readTreatyData(
    await client.api.generations({ id }).get(),
    generationJobResponseSchema
  );
}

export async function postGeneration(
  body: CreateGenerationRequest
): Promise<CreateGenerationResponse> {
  return readTreatyData(
    await client.api.generations.post(body),
    createGenerationResponseSchema
  );
}

export async function listCharacters(): Promise<CharacterResponse[]> {
  return readTreatyData(
    await client.api.characters.get(),
    characterResponseSchema.array()
  );
}

export async function createCharacter(body: {
  name: string;
  spec: unknown;
  visibility: "public" | "private";
}): Promise<CharacterResponse> {
  return readTreatyData(
    await client.api.characters.post(body),
    characterResponseSchema
  );
}

export async function patchCharacter(
  id: string,
  body: {
    name?: string;
    spec?: unknown;
    visibility?: "public" | "private";
  }
): Promise<CharacterResponse> {
  return readTreatyData(
    await client.api.characters({ id }).patch(body),
    characterResponseSchema
  );
}

export async function deleteCharacter(id: string): Promise<void> {
  const result = await client.api.characters({ id }).delete();
  if (result.error) {
    throw result.error;
  }
  if (result.data instanceof Response && !result.data.ok) {
    throw new Error(`Delete failed (${result.data.status})`);
  }
}

export async function listProviderKeys(): Promise<ProviderKeyResponse[]> {
  return readTreatyData(
    await client.api.keys.get(),
    providerKeyResponseSchema.array()
  );
}

export async function createProviderKey(
  body: CreateProviderKeyRequest
): Promise<ProviderKeyResponse> {
  return readTreatyData(
    await client.api.keys.post(body),
    providerKeyResponseSchema
  );
}

export async function deleteProviderKey(id: string): Promise<void> {
  const result = await client.api.keys({ id }).delete();
  if (result.error) {
    throw result.error;
  }
  if (result.data instanceof Response && !result.data.ok) {
    throw new Error(`Delete failed (${result.data.status})`);
  }
}
