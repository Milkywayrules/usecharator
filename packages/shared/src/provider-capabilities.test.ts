import { describe, expect, test } from "bun:test";
import {
  buildProviderCapabilitiesResponse,
  getModelCapabilityDescriptor,
  PROVIDER_CAPABILITY_DESCRIPTORS,
} from "./provider-capabilities";
import { getGenerationCostEstimate } from "./provider-pricing";
import { providerSchema } from "./providers";

describe("provider capability descriptors", () => {
  test("every provider in providerSchema has a descriptor", () => {
    for (const provider of providerSchema.options) {
      const descriptor = PROVIDER_CAPABILITY_DESCRIPTORS.find(
        (entry) => entry.provider === provider
      );
      expect(descriptor).toBeDefined();
      expect(descriptor?.models.length).toBeGreaterThan(0);
    }
  });

  test("catalog models declare reference support where verified", () => {
    for (const descriptor of PROVIDER_CAPABILITY_DESCRIPTORS) {
      for (const model of descriptor.models) {
        expect(model.id.length).toBeGreaterThan(0);
        if (descriptor.provider === "custom") {
          expect(model.supportsReferenceImages.kind).toBe("none");
        }
        if (descriptor.provider === "openai" && model.id === "gpt-image-1") {
          expect(model.supportsReferenceImages.kind).toBe("supported");
        }
      }
    }
  });

  test("openrouter image models flag dedicated API routing", () => {
    expect(
      getModelCapabilityDescriptor(
        "openrouter",
        "google/gemini-2.5-flash-image"
      )?.openRouterImageApi
    ).toBe(true);
  });

  test("buildProviderCapabilitiesResponse attaches costEstimate when priced", () => {
    const response = buildProviderCapabilitiesResponse();
    const openai = response.providers.find(
      (entry) => entry.provider === "openai"
    );
    const gptImage = openai?.models.find((entry) => entry.id === "gpt-image-1");
    expect(gptImage?.costEstimate).toEqual(
      getGenerationCostEstimate("openai", "gpt-image-1")
    );
  });
});
