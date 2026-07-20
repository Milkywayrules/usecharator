import {
  type AspectRatio,
  type CharacterResponse,
  characterResponseSchema,
  characterVisibilitySchema,
  createGenerationRequestSchema,
  createGenerationResponseSchema,
  createSheetRequestSchema,
  createSheetResponseSchema,
  galleryDetailResponseSchema,
  galleryListResponseSchema,
  gallerySortSchema,
  generationJobResponseSchema,
  providerCapabilitiesResponseSchema,
  providerSchema,
  sheetBatchResponseSchema,
  sheetPresetIdSchema,
  specRenderResponseSchema,
} from "@charator/shared";
import { type CharacterSpec, characterSpecSchema } from "@charator/spec";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type CharatorClient, normalizeFetchError } from "./client.js";
import { toolError, toolText } from "./format.js";

const specInputSchema = z
  .unknown()
  .describe("Full character spec v2 object (see get_spec_catalog for fields)");

function parseSpecInput(spec: unknown): CharacterSpec {
  return characterSpecSchema.parse(spec);
}

const themeListItemSchema = z.object({
  description: z.string(),
  id: z.string(),
  label: z.string(),
});

const specCatalogSchema = z.object({
  corePaths: z.array(z.string()),
  fieldCatalog: z.record(z.string(), z.unknown()),
  sectionTitles: z.record(z.string(), z.string()),
});

export async function listThemes(client: CharatorClient) {
  const data = await client.request<unknown[]>("GET", "/themes");
  return z.array(themeListItemSchema).parse(data);
}

export async function getSpecCatalog(client: CharatorClient, section?: string) {
  const data = await client.request<unknown>("GET", "/spec/catalog");
  const catalog = specCatalogSchema.parse(data);
  if (!section?.trim()) {
    return catalog;
  }

  const sectionKey = section.trim();
  const sectionTitle = catalog.sectionTitles[sectionKey];
  if (!sectionTitle) {
    const available = Object.keys(catalog.sectionTitles).sort();
    throw new Error(
      `unknown section "${sectionKey}" — available: ${available.join(", ")}`
    );
  }

  const prefix = `${sectionKey}.`;
  const fieldCatalog = Object.fromEntries(
    Object.entries(catalog.fieldCatalog).filter(([path]) =>
      path.startsWith(prefix)
    )
  );

  return {
    corePaths: catalog.corePaths.filter((path) => path.startsWith(prefix)),
    fieldCatalog,
    section: sectionKey,
    sectionTitle,
  };
}

export async function renderPrompt(
  client: CharatorClient,
  spec: CharacterSpec,
  theme?: string
) {
  const data = await client.request<unknown>("POST", "/spec/render", {
    body: { spec, ...(theme ? { theme } : {}) },
  });
  return specRenderResponseSchema.parse(data);
}

export async function validateSpec(
  client: CharatorClient,
  spec: CharacterSpec
) {
  const result = await renderPrompt(client, spec);
  if (result.errors?.length) {
    return { errors: result.errors, ok: false as const };
  }
  return { ok: true as const, prompt: result.prompt ?? "" };
}

export async function createCharacter(
  client: CharatorClient,
  input: {
    name: string;
    spec: CharacterSpec;
    themeId?: string | null;
    visibility?: z.infer<typeof characterVisibilitySchema>;
  }
) {
  const data = await client.request<unknown>("POST", "/characters", {
    auth: "required",
    body: {
      name: input.name,
      spec: input.spec,
      themeId: input.themeId ?? null,
      visibility: input.visibility ?? "public",
    },
  });
  const character = characterResponseSchema.parse(data);
  return summarizeCharacter(character);
}

export async function listCharacters(client: CharatorClient) {
  const data = await client.request<unknown[]>("GET", "/characters", {
    auth: "required",
  });
  return z.array(characterResponseSchema).parse(data).map(summarizeCharacter);
}

async function fetchOwnedCharacter(
  client: CharatorClient,
  id: string
): Promise<CharacterResponse> {
  const characters = await client.request<unknown[]>("GET", "/characters", {
    auth: "required",
  });
  const parsed = z.array(characterResponseSchema).parse(characters);
  const match = parsed.find((row) => row.id === id);
  if (!match) {
    throw new Error(`character not found: ${id}`);
  }
  return match;
}

export async function getCharacter(client: CharatorClient, id: string) {
  return summarizeCharacter(await fetchOwnedCharacter(client, id));
}

export async function updateCharacter(
  client: CharatorClient,
  id: string,
  patch: {
    name?: string;
    spec?: CharacterSpec;
    themeId?: string | null;
    visibility?: z.infer<typeof characterVisibilitySchema>;
  }
) {
  const data = await client.request<unknown>("PATCH", `/characters/${id}`, {
    auth: "required",
    body: patch,
  });
  return summarizeCharacter(characterResponseSchema.parse(data));
}

export async function remixCharacter(client: CharatorClient, id: string) {
  const data = await client.request<unknown>(
    "POST",
    `/characters/${id}/remix`,
    {
      auth: "required",
    }
  );
  return summarizeCharacter(characterResponseSchema.parse(data));
}

/** Keep gallery detail tool payloads bounded for MCP context windows. */
const MAX_GALLERY_CHARACTER_RESPONSE_CHARS = 32_000;
const MAX_GALLERY_CHARACTER_RENDERS = 6;

export async function browseGallery(
  client: CharatorClient,
  input: {
    limit?: number;
    offset?: number;
    q?: string;
    sort?: z.infer<typeof gallerySortSchema>;
    theme?: string;
  }
) {
  const data = await client.request<unknown>("GET", "/gallery", {
    auth: "optional",
    query: {
      limit: input.limit,
      offset: input.offset ?? 0,
      q: input.q,
      sort: input.sort,
      theme: input.theme,
    },
  });
  return galleryListResponseSchema.parse(data);
}

export async function getGalleryCharacter(client: CharatorClient, id: string) {
  const data = await client.request<unknown>("GET", `/gallery/${id}`, {
    auth: "optional",
  });
  const detail = galleryDetailResponseSchema.parse(data);
  return summarizeGalleryCharacter(detail);
}

export async function getProviderCapabilities(client: CharatorClient) {
  const data = await client.request<unknown>("GET", "/providers/capabilities");
  return providerCapabilitiesResponseSchema.parse(data);
}

export async function generateImage(
  client: CharatorClient,
  input: {
    apiKey?: string;
    aspectRatio?: AspectRatio;
    characterId?: string;
    model?: string;
    provider: z.infer<typeof providerSchema>;
    providerKeyId?: string;
    spec?: CharacterSpec;
    theme?: string;
  }
) {
  let prompt: string;
  let negativePrompt: string | undefined;
  let specSnapshot: CharacterSpec | undefined;
  const { characterId, spec, theme } = input;

  if (characterId) {
    const row = await fetchOwnedCharacter(client, characterId);
    specSnapshot = characterSpecSchema.parse(row.spec);
    const rendered = await renderPrompt(
      client,
      specSnapshot,
      theme ?? row.themeId ?? undefined
    );
    prompt = rendered.prompt ?? "";
    negativePrompt = rendered.negativePrompt;
  } else if (spec) {
    specSnapshot = spec;
    const rendered = await renderPrompt(client, spec, theme);
    prompt = rendered.prompt ?? "";
    negativePrompt = rendered.negativePrompt;
  } else {
    throw new Error("provide characterId or spec");
  }

  if (!prompt.trim()) {
    throw new Error("rendered prompt is empty");
  }

  const body = createGenerationRequestSchema.parse({
    ...(input.apiKey ? { apiKey: input.apiKey } : {}),
    ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
    ...(characterId ? { characterId } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.providerKeyId ? { providerKeyId: input.providerKeyId } : {}),
    ...(negativePrompt ? { negativePrompt } : {}),
    prompt,
    provider: input.provider,
    ...(specSnapshot ? { specSnapshot } : {}),
  });

  const data = await client.request<unknown>("POST", "/generations", {
    auth: "required",
    body,
  });

  return createGenerationResponseSchema.parse(data);
}

export async function generateSheet(
  client: CharatorClient,
  input: {
    apiKey?: string;
    characterId: string;
    model?: string;
    preset: z.infer<typeof sheetPresetIdSchema>;
    provider: z.infer<typeof providerSchema>;
    providerKeyId?: string;
    useAnchor?: boolean;
  }
) {
  await fetchOwnedCharacter(client, input.characterId);

  const body = createSheetRequestSchema.parse({
    ...(input.apiKey ? { apiKey: input.apiKey } : {}),
    ...(input.model ? { model: input.model } : {}),
    ...(input.providerKeyId ? { providerKeyId: input.providerKeyId } : {}),
    ...(input.useAnchor ? { useAnchor: true } : {}),
    preset: input.preset,
    provider: input.provider,
  });

  const data = await client.request<unknown>(
    "POST",
    `/characters/${input.characterId}/sheet`,
    {
      auth: "required",
      body,
    }
  );

  return createSheetResponseSchema.parse(data);
}

export async function getSheetBatch(client: CharatorClient, batchId: string) {
  const data = await client.request<unknown>("GET", `/sheets/${batchId}`, {
    auth: "required",
  });
  return sheetBatchResponseSchema.parse(data);
}

export async function getGeneration(client: CharatorClient, jobId: string) {
  const data = await client.request<unknown>("GET", `/generations/${jobId}`, {
    auth: "optional",
  });
  return generationJobResponseSchema.parse(data);
}

function extractSpecMeta(spec: unknown): unknown {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    return null;
  }
  return { meta: (spec as Record<string, unknown>).meta ?? null };
}

function summarizeGalleryCharacter(
  detail: z.infer<typeof galleryDetailResponseSchema>
) {
  const base = {
    createdAt: detail.createdAt,
    id: detail.id,
    isOwner: detail.isOwner,
    name: detail.name,
    owner: detail.owner,
    referenceImageUrl: detail.referenceImageUrl ?? null,
    remixCount: detail.remixCount,
    remixedFrom: detail.remixedFrom,
    renderCount: detail.renders.length,
    renders: detail.renders.slice(0, MAX_GALLERY_CHARACTER_RENDERS),
    spec: detail.spec,
    themeId: detail.themeId,
    updatedAt: detail.updatedAt,
  };

  if (JSON.stringify(base).length <= MAX_GALLERY_CHARACTER_RESPONSE_CHARS) {
    return base;
  }

  const reduced = {
    ...base,
    spec: extractSpecMeta(detail.spec),
    specTruncated: true as const,
  };
  if (JSON.stringify(reduced).length <= MAX_GALLERY_CHARACTER_RESPONSE_CHARS) {
    return reduced;
  }

  return {
    ...reduced,
    spec: undefined,
    specOmitted: true as const,
  };
}

function summarizeCharacter(character: CharacterResponse) {
  const { spec } = character;
  const metaName =
    spec &&
    typeof spec === "object" &&
    !Array.isArray(spec) &&
    typeof (spec as Record<string, unknown>).meta === "object"
      ? ((spec as { meta?: { name?: string } }).meta?.name ?? "")
      : "";

  return {
    createdAt: character.createdAt,
    id: character.id,
    metaName,
    name: character.name,
    themeId: character.themeId,
    updatedAt: character.updatedAt,
    visibility: character.visibility,
  };
}

async function runTool<T>(
  handler: () => Promise<T>
): Promise<ReturnType<typeof toolText>> {
  try {
    const result = await handler();
    return toolText(result);
  } catch (error) {
    return toolError(normalizeFetchError(error));
  }
}

export function registerTools(server: McpServer, client: CharatorClient): void {
  server.registerTool(
    "list_themes",
    {
      description:
        "List Chara Tor theme presets (id, label, description). Public — no token required. Use theme ids with render_prompt or create_character.",
      inputSchema: {},
    },
    async () => runTool(() => listThemes(client))
  );

  server.registerTool(
    "get_spec_catalog",
    {
      description:
        "Fetch the character spec field catalog: section titles, core paths, and field metadata (types, enums). Optionally pass section (e.g. appearance) to filter fields for that section only.",
      inputSchema: {
        section: z
          .string()
          .optional()
          .describe(
            "Optional section key (identity, appearance, outfit, etc.) to filter catalog entries"
          ),
      },
    },
    async ({ section }) => runTool(() => getSpecCatalog(client, section))
  );

  server.registerTool(
    "render_prompt",
    {
      description:
        "Render a character spec into an image-generation prompt. Validates spec shape server-side. Optional theme applies a preset overlay.",
      inputSchema: {
        spec: specInputSchema,
        theme: z
          .string()
          .optional()
          .describe("Optional theme id from list_themes"),
      },
    },
    async ({ spec, theme }) =>
      runTool(() => renderPrompt(client, parseSpecInput(spec), theme))
  );

  server.registerTool(
    "validate_spec",
    {
      description:
        "Validate a character spec via the Chara Tor API (same rules as render). Returns ok or a list of validation errors.",
      inputSchema: {
        spec: specInputSchema,
      },
    },
    async ({ spec }) =>
      runTool(() => validateSpec(client, parseSpecInput(spec)))
  );

  server.registerTool(
    "create_character",
    {
      description:
        "Save a character to your library. Requires CHARATOR_API_TOKEN. Returns id and summary.",
      inputSchema: {
        name: z.string().min(1).max(120).describe("Display name"),
        spec: specInputSchema,
        themeId: z.string().nullable().optional().describe("Optional theme id"),
        visibility: characterVisibilitySchema
          .optional()
          .describe("public (default) or private"),
      },
    },
    async (input) =>
      runTool(() =>
        createCharacter(client, {
          ...input,
          spec: parseSpecInput(input.spec),
        })
      )
  );

  server.registerTool(
    "list_characters",
    {
      description:
        "List characters in your library. Requires CHARATOR_API_TOKEN.",
      inputSchema: {},
    },
    async () => runTool(() => listCharacters(client))
  );

  server.registerTool(
    "get_character",
    {
      description:
        "Fetch one owned character by id (includes full spec). Requires CHARATOR_API_TOKEN.",
      inputSchema: {
        id: z.string().uuid().describe("Character uuid"),
      },
    },
    async ({ id }) => runTool(() => fetchOwnedCharacter(client, id))
  );

  server.registerTool(
    "update_character",
    {
      description:
        "Partially update an owned character (name, spec, themeId, visibility). Requires CHARATOR_API_TOKEN.",
      inputSchema: {
        id: z.string().uuid().describe("Character uuid"),
        name: z.string().min(1).max(120).optional(),
        spec: specInputSchema.optional(),
        themeId: z.string().nullable().optional(),
        visibility: characterVisibilitySchema.optional(),
      },
    },
    async ({ id, name, spec, themeId, visibility }) =>
      runTool(() =>
        updateCharacter(client, id, {
          ...(name === undefined ? {} : { name }),
          ...(spec === undefined ? {} : { spec: parseSpecInput(spec) }),
          ...(themeId === undefined ? {} : { themeId }),
          ...(visibility === undefined ? {} : { visibility }),
        })
      )
  );

  server.registerTool(
    "remix_character",
    {
      description:
        "Create a private remix copy of a public character (or your own). Requires CHARATOR_API_TOKEN.",
      inputSchema: {
        id: z
          .string()
          .uuid()
          .describe("Public character id to remix into your library"),
      },
    },
    async ({ id }) => runTool(() => remixCharacter(client, id))
  );

  server.registerTool(
    "generate_image",
    {
      description:
        "Start an async image generation job. Requires CHARATOR_API_TOKEN plus either characterId or inline spec. Provide exactly one of providerKeyId (saved key) or apiKey (inline BYOK). Returns jobId — poll with get_generation.",
      inputSchema: {
        apiKey: z
          .string()
          .optional()
          .describe(
            "Inline provider API key (mutually exclusive with providerKeyId)"
          ),
        aspectRatio: z.enum(["1:1", "3:4", "4:3", "16:9", "9:16"]).optional(),
        characterId: z
          .string()
          .uuid()
          .optional()
          .describe("Use saved character spec (mutually exclusive with spec)"),
        model: z.string().optional().describe("Provider model slug override"),
        provider: providerSchema.describe("Image provider"),
        providerKeyId: z
          .string()
          .uuid()
          .optional()
          .describe("Saved provider key id from web settings"),
        spec: specInputSchema
          .optional()
          .describe("Inline spec when not using characterId"),
        theme: z
          .string()
          .optional()
          .describe("Theme override when rendering inline spec"),
      },
    },
    async ({
      apiKey,
      aspectRatio,
      characterId,
      model,
      provider,
      providerKeyId,
      spec,
      theme,
    }) =>
      runTool(() =>
        generateImage(client, {
          apiKey,
          aspectRatio,
          characterId,
          model,
          provider,
          providerKeyId,
          theme,
          ...(spec === undefined ? {} : { spec: parseSpecInput(spec) }),
        })
      )
  );

  server.registerTool(
    "generate_sheet",
    {
      description:
        "Start a character sheet batch (turnaround, expressions, or poses). Requires CHARATOR_API_TOKEN and exactly one of providerKeyId or apiKey.",
      inputSchema: {
        apiKey: z.string().optional(),
        characterId: z.string().uuid(),
        model: z.string().optional(),
        preset: sheetPresetIdSchema.default("turnaround"),
        provider: providerSchema,
        providerKeyId: z.string().uuid().optional(),
        useAnchor: z.boolean().optional(),
      },
    },
    async ({
      apiKey,
      characterId,
      model,
      preset,
      provider,
      providerKeyId,
      useAnchor,
    }) =>
      runTool(() =>
        generateSheet(client, {
          apiKey,
          characterId,
          model,
          preset,
          provider,
          providerKeyId,
          useAnchor,
        })
      )
  );

  server.registerTool(
    "get_generation",
    {
      description:
        "Poll a generation job by jobId. Returns status and imageUrls when succeeded.",
      inputSchema: {
        jobId: z.string().uuid().describe("Job id from generate_image"),
      },
    },
    async ({ jobId }) => runTool(() => getGeneration(client, jobId))
  );

  server.registerTool(
    "browse_gallery",
    {
      description:
        "Browse public gallery characters. Optional name search (q), sort (recent or most_remixed), theme filter, and pagination (offset, limit).",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(48)
          .optional()
          .describe("Page size (default 24, max 48)"),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Pagination offset"),
        q: z
          .string()
          .optional()
          .describe("Case-insensitive name search (max 64 chars)"),
        sort: gallerySortSchema
          .optional()
          .describe("recent (default) or most_remixed"),
        theme: z.string().optional().describe("Filter by theme id"),
      },
    },
    async (input) => runTool(() => browseGallery(client, input))
  );

  server.registerTool(
    "get_gallery_character",
    {
      description:
        "Fetch one public gallery character by id. Returns summary fields plus spec (truncated when large). Optional auth adds isOwner context.",
      inputSchema: {
        id: z.string().uuid().describe("Gallery character uuid"),
      },
    },
    async ({ id }) => runTool(() => getGalleryCharacter(client, id))
  );

  server.registerTool(
    "get_provider_capabilities",
    {
      description:
        "List image providers, models, generation presets, and per-model capabilities including optional BYOK costEstimate ranges. Public — no token required.",
      inputSchema: {},
    },
    async () => runTool(() => getProviderCapabilities(client))
  );
}
