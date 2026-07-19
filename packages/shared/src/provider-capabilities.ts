import { z } from "zod";
import {
  GENERATION_PRESETS,
  generationPresetSchema,
} from "./generation-presets";
import {
  type AspectRatio,
  aspectRatioSchema,
  type Provider,
  providerModelDefaults,
  providerModelOptions,
  providerSchema,
} from "./providers";

/** How a model accepts output aspect ratios. */
export const aspectRatioCapabilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({
    kind: z.literal("fixed"),
    values: z.array(aspectRatioSchema).readonly(),
  }),
  z.object({ kind: z.literal("free") }),
]);

export type AspectRatioCapability = z.infer<typeof aspectRatioCapabilitySchema>;

/** Reference-image anchoring — Epic 6.1 fills in maxCount values. */
export const referenceImageCapabilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({
    kind: z.literal("supported"),
    maxCount: z.number().int().positive(),
  }),
]);

export type ReferenceImageCapability = z.infer<
  typeof referenceImageCapabilitySchema
>;

export const executionModeSchema = z.enum(["sync", "async"]);

export type ExecutionMode = z.infer<typeof executionModeSchema>;

export const modelCapabilityDescriptorSchema = z.object({
  execution: executionModeSchema,
  id: z.string(),
  label: z.string(),
  /** When true, OpenRouter adapter prefers `/api/v1/images` with chat fallback. */
  openRouterImageApi: z.boolean().optional(),
  supportsAspectRatios: aspectRatioCapabilitySchema,
  supportsNegativePrompt: z.boolean(),
  supportsReferenceImages: referenceImageCapabilitySchema,
});

export type ModelCapabilityDescriptor = z.infer<
  typeof modelCapabilityDescriptorSchema
>;

export const providerCapabilityDescriptorSchema = z.object({
  defaultModel: z.string(),
  label: z.string(),
  models: z.array(modelCapabilityDescriptorSchema),
  provider: providerSchema,
});

export type ProviderCapabilityDescriptor = z.infer<
  typeof providerCapabilityDescriptorSchema
>;

export const providerCapabilitiesResponseSchema = z.object({
  presets: z.array(generationPresetSchema),
  providers: z.array(providerCapabilityDescriptorSchema),
});

export type ProviderCapabilitiesResponse = z.infer<
  typeof providerCapabilitiesResponseSchema
>;

const STANDARD_ASPECT_RATIOS = [
  "1:1",
  "3:4",
  "4:3",
  "16:9",
  "9:16",
] as const satisfies readonly AspectRatio[];

const FIXED_STANDARD: AspectRatioCapability = {
  kind: "fixed",
  values: STANDARD_ASPECT_RATIOS,
};

const NO_REFERENCE: ReferenceImageCapability = { kind: "none" };

function modelDescriptor(
  provider: Provider,
  id: string,
  label: string,
  overrides: Partial<
    Pick<
      ModelCapabilityDescriptor,
      | "execution"
      | "openRouterImageApi"
      | "supportsAspectRatios"
      | "supportsNegativePrompt"
      | "supportsReferenceImages"
    >
  > = {}
): ModelCapabilityDescriptor {
  const defaults: ModelCapabilityDescriptor = {
    execution:
      provider === "fal" || provider === "replicate" ? "async" : "sync",
    id,
    label,
    supportsAspectRatios: FIXED_STANDARD,
    supportsNegativePrompt: provider === "fal" || provider === "replicate",
    supportsReferenceImages: NO_REFERENCE,
  };

  return { ...defaults, ...overrides };
}

/** Typed capability catalog — extend `supportsReferenceImages` in Epic 6.1. */
export const PROVIDER_CAPABILITY_DESCRIPTORS: ProviderCapabilityDescriptor[] =
  providerSchema.options.map((provider) => {
    const catalog = providerModelOptions[provider];
    const models = catalog.models.map((entry) => {
      switch (provider) {
        case "openrouter":
          return modelDescriptor(provider, entry.id, entry.label, {
            openRouterImageApi: true,
            supportsNegativePrompt: false,
          });
        case "openai":
          return modelDescriptor(provider, entry.id, entry.label, {
            supportsNegativePrompt: false,
          });
        case "gemini":
          return modelDescriptor(provider, entry.id, entry.label, {
            supportsNegativePrompt: false,
          });
        case "fal":
          return modelDescriptor(provider, entry.id, entry.label);
        case "replicate":
          return modelDescriptor(provider, entry.id, entry.label);
        case "custom":
          return modelDescriptor(provider, entry.id, entry.label, {
            supportsNegativePrompt: false,
          });
        default:
          return modelDescriptor(provider, entry.id, entry.label);
      }
    });

    return {
      defaultModel: providerModelDefaults[provider],
      label: catalog.label,
      models,
      provider,
    };
  });

export function getProviderCapabilityDescriptor(
  provider: Provider
): ProviderCapabilityDescriptor | undefined {
  return PROVIDER_CAPABILITY_DESCRIPTORS.find(
    (entry) => entry.provider === provider
  );
}

export function getModelCapabilityDescriptor(
  provider: Provider,
  modelId: string
): ModelCapabilityDescriptor | undefined {
  return getProviderCapabilityDescriptor(provider)?.models.find(
    (entry) => entry.id === modelId
  );
}

export function buildProviderCapabilitiesResponse(): ProviderCapabilitiesResponse {
  return {
    presets: GENERATION_PRESETS,
    providers: PROVIDER_CAPABILITY_DESCRIPTORS,
  };
}

export function openRouterUsesImageApi(modelId: string): boolean {
  return (
    getModelCapabilityDescriptor("openrouter", modelId)?.openRouterImageApi ===
    true
  );
}
