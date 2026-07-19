import { describe, expect, test } from "bun:test";
import { createGenerationRequestSchema } from "./generation";
import { providerModelDefaults, providerSchema } from "./providers";

describe("shared DTOs", () => {
  test("validates generation requests with inline api keys", () => {
    const parsed = createGenerationRequestSchema.safeParse({
      apiKey: "sk-test",
      prompt: "hero portrait",
      provider: "openai",
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects requests with both apiKey and providerKeyId", () => {
    const parsed = createGenerationRequestSchema.safeParse({
      apiKey: "sk-test",
      prompt: "hero portrait",
      provider: "openai",
      providerKeyId: "11111111-1111-1111-1111-111111111111",
    });
    expect(parsed.success).toBe(false);
  });

  test("exports provider defaults for every provider enum value", () => {
    for (const provider of providerSchema.options) {
      expect(providerModelDefaults[provider]).toBeString();
    }
  });
});
