import type { AspectRatio } from "@charator/shared";

const OPENAI_SIZES: Record<AspectRatio, string> = {
  "1:1": "1024x1024",
  "3:4": "1152x1536",
  "4:3": "1536x1152",
  "9:16": "1024x1536",
  "16:9": "1536x1024",
};

/** Maps Chara Tor aspect ratios to OpenAI `size` values for gpt-image-1. */
export function aspectRatioToOpenAiSize(aspectRatio?: AspectRatio): string {
  return OPENAI_SIZES[aspectRatio ?? "1:1"];
}

/**
 * fal FLUX models use `image_size` presets — not `aspect_ratio`.
 * @see https://fal.ai/docs/documentation/model-apis/model-arguments
 */
const FAL_FLUX_IMAGE_SIZES: Record<AspectRatio, string> = {
  "1:1": "square_hd",
  "3:4": "portrait_4_3",
  "4:3": "landscape_4_3",
  "9:16": "portrait_16_9",
  "16:9": "landscape_16_9",
};

export function aspectRatioToFalImageSize(
  aspectRatio?: AspectRatio
): string | undefined {
  if (!aspectRatio) {
    return;
  }
  return FAL_FLUX_IMAGE_SIZES[aspectRatio];
}

/** Replicate flux models accept `aspect_ratio` as w:h strings directly. */
export function aspectRatioToReplicateParam(
  aspectRatio?: AspectRatio
): string | undefined {
  return aspectRatio;
}

/** Gemini image models accept `aspectRatio` inside `generationConfig.imageConfig`. */
export function aspectRatioToGeminiImageConfig(
  aspectRatio?: AspectRatio
): { aspectRatio: AspectRatio } | undefined {
  if (!aspectRatio) {
    return;
  }
  return { aspectRatio };
}

/** OpenRouter Image API accepts normalized `aspect_ratio` strings. */
export function aspectRatioToOpenRouterParam(
  aspectRatio?: AspectRatio
): AspectRatio | undefined {
  return aspectRatio;
}
