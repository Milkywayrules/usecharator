import { describe, expect, test } from "bun:test";
import {
  formatCostEstimateBatchTotal,
  formatCostEstimatePerImage,
  getGenerationCostEstimate,
  scaleCostEstimate,
} from "./provider-pricing";

describe("getGenerationCostEstimate", () => {
  test("returns estimate for catalog openai model", () => {
    const estimate = getGenerationCostEstimate("openai", "gpt-image-1");
    expect(estimate).not.toBeNull();
    if (!estimate) {
      return;
    }
    expect(estimate.usdMin).toBeGreaterThan(0);
    expect(estimate.usdMax).toBeGreaterThanOrEqual(estimate.usdMin);
  });

  test("returns estimate for each provider in the pricing table", () => {
    const samples: [Parameters<typeof getGenerationCostEstimate>[0], string][] =
      [
        ["openrouter", "google/gemini-2.5-flash-image"],
        ["gemini", "gemini-2.5-flash-image"],
        ["fal", "fal-ai/flux/dev"],
        ["replicate", "black-forest-labs/flux-schnell"],
        ["custom", "dall-e-3"],
      ];
    for (const [provider, modelId] of samples) {
      expect(getGenerationCostEstimate(provider, modelId)).not.toBeNull();
    }
  });

  test("returns null for unknown model", () => {
    expect(getGenerationCostEstimate("openai", "unknown-model")).toBeNull();
  });
});

describe("cost estimate formatting", () => {
  test("formatCostEstimatePerImage includes provider billing note", () => {
    const estimate = getGenerationCostEstimate("openai", "gpt-image-1");
    expect(estimate).not.toBeNull();
    if (!estimate) {
      return;
    }
    expect(formatCostEstimatePerImage(estimate)).toContain("per image");
    expect(formatCostEstimatePerImage(estimate)).toContain(
      "provider bills separately"
    );
  });
});

describe("scaleCostEstimate", () => {
  test("multiplies min and max by batch count", () => {
    const estimate = getGenerationCostEstimate("fal", "fal-ai/flux/schnell");
    expect(estimate).not.toBeNull();
    if (!estimate) {
      return;
    }
    const batch = scaleCostEstimate(estimate, 4);
    expect(batch.usdMin).toBeCloseTo(estimate.usdMin * 4);
    expect(batch.usdMax).toBeCloseTo(estimate.usdMax * 4);
  });

  test("formatCostEstimateBatchTotal reflects scaled range", () => {
    const estimate = getGenerationCostEstimate("fal", "fal-ai/flux/schnell");
    expect(estimate).not.toBeNull();
    if (!estimate) {
      return;
    }
    const formatted = formatCostEstimateBatchTotal(estimate, 4);
    expect(formatted).toContain("estimated total");
    expect(formatted).toContain("provider bills separately");
  });

  test("zero count yields zero totals", () => {
    const estimate = getGenerationCostEstimate("openai", "gpt-image-1");
    expect(estimate).not.toBeNull();
    if (!estimate) {
      return;
    }
    const batch = scaleCostEstimate(estimate, 0);
    expect(batch.usdMin).toBe(0);
    expect(batch.usdMax).toBe(0);
  });
});
