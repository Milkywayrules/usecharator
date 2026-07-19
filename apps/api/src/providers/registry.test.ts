import { describe, expect, test } from "bun:test";
import { getProviderAdapter, providerRegistry } from "./registry";

describe("provider registry", () => {
	test("registers all six providers", () => {
		expect(providerRegistry.size).toBe(6);
		for (const provider of [
			"openrouter",
			"openai",
			"gemini",
			"fal",
			"replicate",
			"custom",
		] as const) {
			expect(getProviderAdapter(provider).provider).toBe(provider);
		}
	});

	test("rejects unknown providers", () => {
		expect(() => getProviderAdapter("unknown")).toThrow("unsupported provider");
	});
});
