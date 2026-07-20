/** Optional image-prompt suffix families for provider-specific generation. */

export const PROMPT_TEMPLATE_FAMILIES = [
  "natural-language",
  "anime-tags",
  "sdxl",
] as const;

export type PromptTemplateFamily = (typeof PROMPT_TEMPLATE_FAMILIES)[number];

const ANIME_TAGS_SUFFIX =
  "masterpiece, best quality, anime, highly detailed, vibrant colors, sharp focus";

const SDXL_SUFFIX =
  "score_9, score_8_up, score_7_up, masterpiece, best quality, very aesthetic, absurdres";

/** Append a provider-family suffix when template is not natural-language. */
export function applyPromptTemplateSuffix(
  base: string,
  template?: PromptTemplateFamily
): string {
  if (!template || template === "natural-language") {
    return base;
  }
  if (template === "anime-tags") {
    return `${base}, ${ANIME_TAGS_SUFFIX}`;
  }
  return `${base}, ${SDXL_SUFFIX}`;
}
