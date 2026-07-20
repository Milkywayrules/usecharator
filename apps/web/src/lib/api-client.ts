import type { App } from "@charator/api/src/index";
import {
  type ApiTokenListItem,
  activateWorkspaceResponseSchema,
  apiTokenListItemSchema,
  type CharacterGenerationsResponse,
  type CharacterResponse,
  type CreateApiTokenResponse,
  type CreateGenerationRequest,
  type CreateGenerationResponse,
  type CreateProviderKeyRequest,
  type CreateSheetRequest,
  type CreateSheetResponse,
  characterGenerationsResponseSchema,
  characterResponseSchema,
  createApiTokenResponseSchema,
  createGenerationResponseSchema,
  createSheetResponseSchema,
  type EntitlementsResponse,
  entitlementsResponseSchema,
  type GalleryDetailResponse,
  type GalleryListResponse,
  type GenerationJobResponse,
  galleryDetailResponseSchema,
  galleryListResponseSchema,
  generationJobResponseSchema,
  type ProviderCapabilitiesResponse,
  type ProviderKeyResponse,
  providerCapabilitiesResponseSchema,
  providerKeyResponseSchema,
  type ReportCharacterRequest,
  type ReportCharacterResponse,
  type RerollGenerationRequest,
  type RerollGenerationResponse,
  reportCharacterResponseSchema,
  rerollGenerationResponseSchema,
  type SheetBatchResponse,
  sheetBatchResponseSchema,
  type TelegramLinkCodeResponse,
  type TelegramLinkStatus,
  telegramLinkCodeResponseSchema,
  telegramLinkStatusSchema,
  type WorkspaceListResponse,
  type WorkspaceResponse,
  workspaceListResponseSchema,
  workspaceResponseSchema,
} from "@charator/shared";
import type { ThemeId } from "@charator/spec";
import { treaty } from "@elysiajs/eden";
import type { QueryClient } from "@tanstack/react-query";
import { themeIdForRequest } from "./theme-id";

function resolveBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
}

const client = treaty<App>(resolveBaseUrl());
// biome-ignore lint/suspicious/noExplicitAny: route-table mounts are not reflected on the exported App type
const api = client.api as any;

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
    await api.generations({ id }).get(),
    generationJobResponseSchema
  );
}

export async function postGeneration(
  body: CreateGenerationRequest
): Promise<CreateGenerationResponse> {
  return readTreatyData(
    await api.generations.post(body),
    createGenerationResponseSchema
  );
}

export async function listCharacters(): Promise<CharacterResponse[]> {
  const response = await fetch(`${resolveBaseUrl()}/api/characters`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`characters request failed (${response.status})`);
  }
  return characterResponseSchema.array().parse(await response.json());
}

export async function createCharacter(body: {
  name: string;
  spec: unknown;
  themeId?: ThemeId | null;
  visibility: "public" | "private";
}): Promise<CharacterResponse> {
  return readTreatyData(
    await api.characters.post({
      name: body.name,
      spec: body.spec,
      visibility: body.visibility,
      ...themeIdForRequest(body.themeId),
    }),
    characterResponseSchema
  );
}

export async function patchCharacter(
  id: string,
  body: {
    name?: string;
    spec?: unknown;
    themeId?: ThemeId | null;
    visibility?: "public" | "private";
  }
): Promise<CharacterResponse> {
  return readTreatyData(
    await api.characters({ id }).patch({
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.spec === undefined ? {} : { spec: body.spec }),
      ...(body.visibility === undefined ? {} : { visibility: body.visibility }),
      ...themeIdForRequest(body.themeId),
    }),
    characterResponseSchema
  );
}

export async function deleteCharacter(id: string): Promise<void> {
  const result = await api.characters({ id }).delete();
  if (result.error) {
    throw result.error;
  }
  if (result.data instanceof Response && !result.data.ok) {
    throw new Error(`Delete failed (${result.data.status})`);
  }
}

export async function listGallery(params?: {
  limit?: number;
  offset?: number;
  q?: string | null;
  theme?: string | null;
}): Promise<GalleryListResponse> {
  const query: Record<string, string> = {};
  if (params?.offset !== undefined) {
    query.offset = String(params.offset);
  }
  if (params?.limit !== undefined) {
    query.limit = String(params.limit);
  }
  if (params?.theme) {
    query.theme = params.theme;
  }
  if (params?.q) {
    query.q = params.q;
  }
  return readTreatyData(
    await api.gallery.get({ query }),
    galleryListResponseSchema
  );
}

export async function getGalleryCharacter(
  id: string
): Promise<GalleryDetailResponse> {
  return readTreatyData(
    await api.gallery({ id }).get(),
    galleryDetailResponseSchema
  );
}

export async function remixCharacter(id: string): Promise<CharacterResponse> {
  return readTreatyData(
    await api.characters({ id }).remix.post(),
    characterResponseSchema
  );
}

export async function listProviderKeys(): Promise<ProviderKeyResponse[]> {
  return readTreatyData(
    await api.keys.get(),
    providerKeyResponseSchema.array()
  );
}

export async function createProviderKey(
  body: CreateProviderKeyRequest
): Promise<ProviderKeyResponse> {
  return readTreatyData(await api.keys.post(body), providerKeyResponseSchema);
}

export async function deleteProviderKey(id: string): Promise<void> {
  const result = await api.keys({ id }).delete();
  if (result.error) {
    throw result.error;
  }
  if (result.data instanceof Response && !result.data.ok) {
    throw new Error(`Delete failed (${result.data.status})`);
  }
}

export async function listApiTokens(): Promise<ApiTokenListItem[]> {
  return readTreatyData(await api.tokens.get(), apiTokenListItemSchema.array());
}

export async function createApiToken(body: {
  name: string;
}): Promise<CreateApiTokenResponse> {
  return readTreatyData(
    await api.tokens.post(body),
    createApiTokenResponseSchema
  );
}

export async function revokeApiToken(id: string): Promise<void> {
  const result = await api.tokens({ id }).delete();
  if (result.error) {
    throw result.error;
  }
  if (result.data instanceof Response && !result.data.ok) {
    throw new Error(`Revoke failed (${result.data.status})`);
  }
}

export async function reportGalleryCharacter(
  id: string,
  body: ReportCharacterRequest
): Promise<ReportCharacterResponse> {
  return readTreatyData(
    await api.gallery({ id }).report.post(body),
    reportCharacterResponseSchema
  );
}

export async function rerollGeneration(
  id: string,
  body: RerollGenerationRequest = {}
): Promise<RerollGenerationResponse> {
  return readTreatyData(
    await api.generations({ id }).reroll.post(body),
    rerollGenerationResponseSchema
  );
}

export async function getTelegramLinkStatus(): Promise<TelegramLinkStatus> {
  return readTreatyData(
    await api.telegram.link.get(),
    telegramLinkStatusSchema
  );
}

export async function createTelegramLinkCode(): Promise<TelegramLinkCodeResponse> {
  return readTreatyData(
    await api.telegram["link-code"].post(),
    telegramLinkCodeResponseSchema
  );
}

export async function updateTelegramLink(body: {
  notifyTelegram: boolean;
}): Promise<TelegramLinkStatus> {
  return readTreatyData(
    await api.telegram.link.patch(body),
    telegramLinkStatusSchema
  );
}

export async function deleteTelegramLink(): Promise<void> {
  const result = await api.telegram.link.delete();
  if (result.error) {
    throw result.error;
  }
  if (result.data instanceof Response && !result.data.ok) {
    throw new Error(`Disconnect failed (${result.data.status})`);
  }
}

export async function listCharacterGenerations(
  id: string,
  params?: { limit?: number; offset?: number }
): Promise<CharacterGenerationsResponse> {
  const query: Record<string, string> = {};
  if (params?.offset !== undefined) {
    query.offset = String(params.offset);
  }
  if (params?.limit !== undefined) {
    query.limit = String(params.limit);
  }
  return readTreatyData(
    await api.characters({ id }).generations.get({ query }),
    characterGenerationsResponseSchema
  );
}

export async function getProviderCapabilities(): Promise<ProviderCapabilitiesResponse> {
  const response = await fetch(
    `${resolveBaseUrl()}/api/v1/providers/capabilities`
  );
  if (!response.ok) {
    throw new Error(`capabilities request failed (${response.status})`);
  }
  return providerCapabilitiesResponseSchema.parse(await response.json());
}

export async function setCharacterAnchorFromJob(
  characterId: string,
  fromJobId: string,
  imageIndex = 0
): Promise<CharacterResponse> {
  return readTreatyData(
    await api.characters({ id: characterId }).anchor.post({
      fromJobId,
      imageIndex,
    }),
    characterResponseSchema
  );
}

export async function deleteCharacterAnchor(
  characterId: string
): Promise<void> {
  const result = await api.characters({ id: characterId }).anchor.delete();
  if (result.error) {
    throw result.error;
  }
  if (result.data instanceof Response && !result.data.ok) {
    throw new Error(`Delete anchor failed (${result.data.status})`);
  }
}

export async function postCharacterSheet(
  characterId: string,
  body: CreateSheetRequest
): Promise<CreateSheetResponse> {
  const response = await fetch(
    `${resolveBaseUrl()}/api/characters/${characterId}/sheet`,
    {
      body: JSON.stringify(body),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `sheet request failed (${response.status})`;
    throw new Error(message);
  }
  return createSheetResponseSchema.parse(await response.json());
}

export async function getSheetBatch(
  batchId: string
): Promise<SheetBatchResponse> {
  const response = await fetch(`${resolveBaseUrl()}/api/sheets/${batchId}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `sheet batch request failed (${response.status})`;
    throw new Error(message);
  }
  return sheetBatchResponseSchema.parse(await response.json());
}

async function readJsonOrThrow(response: Response): Promise<unknown> {
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Request failed (${response.status})`;
    const error = new Error(message) as Error & {
      body?: unknown;
      status?: number;
    };
    error.body = payload;
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function getEntitlements(): Promise<EntitlementsResponse> {
  const response = await fetch(`${resolveBaseUrl()}/api/me/entitlements`, {
    credentials: "include",
  });
  const json = await readJsonOrThrow(response);
  return entitlementsResponseSchema.parse(json);
}

export async function deleteGeneration(id: string): Promise<void> {
  const response = await fetch(`${resolveBaseUrl()}/api/generations/${id}`, {
    credentials: "include",
    method: "DELETE",
  });
  if (!response.ok) {
    await readJsonOrThrow(response);
  }
}

export async function listWorkspaces(): Promise<WorkspaceListResponse> {
  const response = await fetch(`${resolveBaseUrl()}/api/workspaces`, {
    credentials: "include",
  });
  const json = await readJsonOrThrow(response);
  return workspaceListResponseSchema.parse(json);
}

export async function createWorkspace(
  name: string
): Promise<WorkspaceResponse> {
  const response = await fetch(`${resolveBaseUrl()}/api/workspaces`, {
    body: JSON.stringify({ name }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const json = await readJsonOrThrow(response);
  return workspaceResponseSchema.parse(json);
}

export async function updateWorkspace(
  id: string,
  body: { name: string }
): Promise<WorkspaceResponse> {
  const response = await fetch(`${resolveBaseUrl()}/api/workspaces/${id}`, {
    body: JSON.stringify(body),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  const json = await readJsonOrThrow(response);
  return workspaceResponseSchema.parse(json);
}

export async function deleteWorkspace(id: string): Promise<void> {
  const response = await fetch(`${resolveBaseUrl()}/api/workspaces/${id}`, {
    credentials: "include",
    method: "DELETE",
  });
  if (!response.ok) {
    await readJsonOrThrow(response);
  }
}

export async function activateWorkspace(id: string): Promise<void> {
  const response = await fetch(
    `${resolveBaseUrl()}/api/workspaces/${id}/activate`,
    {
      credentials: "include",
      method: "POST",
    }
  );
  const json = await readJsonOrThrow(response);
  activateWorkspaceResponseSchema.parse(json);
}

export function invalidateWorkspaceScopedQueries(
  queryClient: QueryClient
): void {
  queryClient.invalidateQueries({ queryKey: ["characters"] });
  queryClient.invalidateQueries({ queryKey: ["provider-keys"] });
  queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
  queryClient.invalidateQueries({ queryKey: ["entitlements"] });
}
