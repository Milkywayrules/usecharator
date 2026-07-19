import { describe, expect, test } from "bun:test";
import { buildProviderCapabilitiesResponse } from "@charator/shared";
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
});
