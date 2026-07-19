import { describe, expect, test } from "bun:test";
import {
  getModelCapabilityDescriptor,
  PROVIDER_CAPABILITY_DESCRIPTORS,
} from "./provider-capabilities";
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
});
