import { z } from "zod";
import {
  GENERATION_PRESETS,
  generationPresetSchema,
} from "./generation-presets";
import { getGenerationCostEstimate } from "./provider-pricing";
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

export const generationCostEstimateSchema = z.object({
  label: z.string(),
  usdMax: z.number(),
  usdMin: z.number(),
});

export type GenerationCostEstimateResponse = z.infer<
  typeof generationCostEstimateSchema
>;

export const modelCapabilityDescriptorSchema = z.object({
  /** Present when a manual BYOK cost estimate exists for this model. */
  costEstimate: generationCostEstimateSchema.optional(),
  execution: executionModeSchema,
  id: z.string(),
  label: z.string(),
  /** When true, OpenRouter adapter prefers `/api/v1/images` with chat fallback. */
  openRouterImageApi: z.boolean().optional(),
  supportsAspectRatios: aspectRatioCapabilitySchema,
  supportsNegativePrompt: z.boolean(),
  supportsReferenceImages: referenceImageCapabilitySchema,
  /** When true, `referenceStrength` (0–1) is forwarded to the provider adapter. */
  supportsReferenceStrength: z.boolean().optional(),
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

const SINGLE_REFERENCE: ReferenceImageCapability = {
  kind: "supported",
  maxCount: 1,
};

const MULTI_REFERENCE: ReferenceImageCapability = {
  kind: "supported",
  maxCount: 8,
};

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
      | "supportsReferenceStrength"
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
            supportsReferenceImages: SINGLE_REFERENCE,
          });
        case "openai":
          return modelDescriptor(provider, entry.id, entry.label, {
            supportsNegativePrompt: false,
            supportsReferenceImages: SINGLE_REFERENCE,
            supportsReferenceStrength: true,
          });
        case "gemini":
          return modelDescriptor(provider, entry.id, entry.label, {
            supportsNegativePrompt: false,
            supportsReferenceImages: SINGLE_REFERENCE,
          });
        case "fal":
          return modelDescriptor(
            provider,
            entry.id,
            entry.label,
            entry.id === "fal-ai/ideogram/character"
              ? {
                  supportsNegativePrompt: false,
                  supportsReferenceImages: SINGLE_REFERENCE,
                }
              : {}
          );
        case "replicate":
          return modelDescriptor(
            provider,
            entry.id,
            entry.label,
            entry.id === "black-forest-labs/flux-2-pro"
              ? { supportsReferenceImages: MULTI_REFERENCE }
              : {}
          );
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

function attachCostEstimate(
  provider: Provider,
  model: ModelCapabilityDescriptor
): ModelCapabilityDescriptor {
  const costEstimate = getGenerationCostEstimate(provider, model.id);
  if (!costEstimate) {
    return model;
  }
  return { ...model, costEstimate };
}

export function buildProviderCapabilitiesResponse(): ProviderCapabilitiesResponse {
  return {
    presets: GENERATION_PRESETS,
    providers: PROVIDER_CAPABILITY_DESCRIPTORS.map((descriptor) => ({
      ...descriptor,
      models: descriptor.models.map((model) =>
        attachCostEstimate(descriptor.provider, model)
      ),
    })),
  };
}

export function openRouterUsesImageApi(modelId: string): boolean {
  return (
    getModelCapabilityDescriptor("openrouter", modelId)?.openRouterImageApi ===
    true
  );
}
