import { describe, expect, test } from "bun:test";
import {
  buildProviderCapabilitiesResponse,
  getGenerationCostEstimate,
} from "@charator/shared";
import { handleProviderCapabilities } from "./providers";

describe("provider capabilities route", () => {
  test("returns 200 JSON with providers and presets", async () => {
    const response = handleProviderCapabilities();
    expect(response.status).toBe(200);
    const body = await response.json();
    const parsed = buildProviderCapabilitiesResponse();
    expect(body.providers).toHaveLength(parsed.providers.length);
    expect(body.presets).toHaveLength(parsed.presets.length);
  });

  test("includes optional costEstimate on priced models", async () => {
    const response = handleProviderCapabilities();
    const body = (await response.json()) as ReturnType<
      typeof buildProviderCapabilitiesResponse
    >;
    const openai = body.providers.find((entry) => entry.provider === "openai");
    const gptImage = openai?.models.find((entry) => entry.id === "gpt-image-1");
    expect(gptImage?.costEstimate).toEqual(
      getGenerationCostEstimate("openai", "gpt-image-1")
    );
  });
});
