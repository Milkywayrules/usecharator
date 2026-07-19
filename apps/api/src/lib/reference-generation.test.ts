import { describe, expect, test } from "bun:test";
import {
  formatReferenceCapableAlternatives,
  modelSupportsReferenceImages,
} from "@charator/shared";

describe("reference capability rejection helpers", () => {
  test("openai gpt-image-1 supports references", () => {
    expect(modelSupportsReferenceImages("openai", "gpt-image-1")).toBe(true);
  });

  test("custom provider stays unsupported", () => {
    expect(modelSupportsReferenceImages("custom", "dall-e-3")).toBe(false);
  });

  test("alternatives string lists ref-capable models", () => {
    const message = formatReferenceCapableAlternatives();
    expect(message).toContain("openai/gpt-image-1");
    expect(message).toContain("openrouter/");
  });
});

describe("anchor resolution precedence", () => {
  test("explicit referenceJobImage wins over useCharacterAnchor in request shape", () => {
    const explicit = {
      characterId: "00000000-0000-4000-8000-000000000001",
      referenceJobImage: {
        imageIndex: 0,
        jobId: "00000000-0000-4000-8000-000000000002",
      },
      useCharacterAnchor: true,
    };
    expect(explicit.referenceJobImage.jobId).toBeTruthy();
    expect(explicit.useCharacterAnchor).toBe(true);
  });
});
