import { describe, expect, test } from "bun:test";
import { GENERATION_PRESETS } from "./generation-presets";
import { getModelCapabilityDescriptor } from "./provider-capabilities";
import { providerModelOptions } from "./providers";

describe("generation preset catalog", () => {
  test("every preset references a valid provider and model", () => {
    for (const preset of GENERATION_PRESETS) {
      const catalog = providerModelOptions[preset.provider];
      expect(catalog.models.some((entry) => entry.id === preset.model)).toBe(
        true
      );
    }
  });

  test("presets are capability-consistent with their model", () => {
    for (const preset of GENERATION_PRESETS) {
      const capability = getModelCapabilityDescriptor(
        preset.provider,
        preset.model
      );
      expect(capability).toBeDefined();

      if (preset.badges.includes("aspect-ratio")) {
        expect(capability?.supportsAspectRatios.kind).not.toBe("none");
      }
      if (preset.badges.includes("negative-prompt")) {
        expect(capability?.supportsNegativePrompt).toBe(true);
      }
    }
  });

  test("preset ids are unique", () => {
    const ids = GENERATION_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
