import { describe, expect, test } from "bun:test";
import {
  aspectRatioToFalImageSize,
  aspectRatioToGeminiImageConfig,
  aspectRatioToOpenAiSize,
  aspectRatioToOpenRouterParam,
  aspectRatioToReplicateParam,
} from "./aspect-ratio";

describe("aspect ratio mapping helpers", () => {
  test("openai size defaults to 1:1", () => {
    expect(aspectRatioToOpenAiSize()).toBe("1024x1024");
    expect(aspectRatioToOpenAiSize("16:9")).toBe("1536x1024");
  });

  test("fal flux image_size presets", () => {
    expect(aspectRatioToFalImageSize("9:16")).toBe("portrait_16_9");
    expect(aspectRatioToFalImageSize()).toBeUndefined();
  });

  test("replicate passes ratio through", () => {
    expect(aspectRatioToReplicateParam("4:3")).toBe("4:3");
    expect(aspectRatioToReplicateParam()).toBeUndefined();
  });

  test("gemini imageConfig wrapper", () => {
    expect(aspectRatioToGeminiImageConfig("3:4")).toEqual({
      aspectRatio: "3:4",
    });
    expect(aspectRatioToGeminiImageConfig()).toBeUndefined();
  });

  test("openrouter passes ratio through", () => {
    expect(aspectRatioToOpenRouterParam("16:9")).toBe("16:9");
    expect(aspectRatioToOpenRouterParam()).toBeUndefined();
  });
});
