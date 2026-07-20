import { describe, expect, test } from "bun:test";
import { createEmptySpec } from "../src/empty";
import {
  applyPromptTemplateSuffix,
  PROMPT_TEMPLATE_FAMILIES,
} from "../src/prompt-templates";
import { renderPrompt } from "../src/themes";

describe("prompt template families", () => {
  test("exports three families", () => {
    expect(PROMPT_TEMPLATE_FAMILIES).toEqual([
      "natural-language",
      "anime-tags",
      "sdxl",
    ]);
  });

  test("natural-language leaves base unchanged", () => {
    const base = "Modern anime illustration of Luna.";
    expect(applyPromptTemplateSuffix(base)).toBe(base);
    expect(applyPromptTemplateSuffix(base, "natural-language")).toBe(base);
  });

  test("anime-tags appends tag suffix", () => {
    const result = applyPromptTemplateSuffix("hero portrait", "anime-tags");
    expect(result).toContain("hero portrait");
    expect(result).toContain("masterpiece");
    expect(result).toContain("anime");
  });

  test("sdxl appends score suffix", () => {
    const result = applyPromptTemplateSuffix("hero portrait", "sdxl");
    expect(result).toContain("score_9");
    expect(result).toContain("absurdres");
  });

  test("renderPrompt applies optional template suffix", () => {
    const spec = createEmptySpec();
    spec.meta.name = "Luna";
    const base = renderPrompt(spec);
    const tagged = renderPrompt(spec, { template: "sdxl" });
    expect(tagged.startsWith(base)).toBe(true);
    expect(tagged).toContain("score_9");
  });
});
