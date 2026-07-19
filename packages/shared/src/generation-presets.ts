import { z } from "zod";
import { type Provider, providerSchema } from "./providers";

export const generationPresetGoalSchema = z.enum([
  "fast",
  "quality",
  "consistency",
]);

export type GenerationPresetGoal = z.infer<typeof generationPresetGoalSchema>;

export const generationPresetSchema = z.object({
  badges: z.array(z.string()),
  description: z.string(),
  goal: generationPresetGoalSchema,
  id: z.string(),
  label: z.string(),
  model: z.string(),
  notes: z.string().optional(),
  provider: providerSchema,
  /** Theme affinity — empty means any theme. */
  themeIds: z.array(z.string()).optional(),
});

export type GenerationPreset = z.infer<typeof generationPresetSchema>;

/** Curated provider+model picks — no DB until presets need user editing. */
export const GENERATION_PRESETS: GenerationPreset[] = [
  {
    badges: ["fast", "aspect-ratio", "negative-prompt"],
    description: "Fast Flux Schnell on fal.ai for anime-style drafts.",
    goal: "fast",
    id: "anime-fast",
    label: "Anime fast",
    model: "fal-ai/flux/schnell",
    notes: "Best for quick iteration on anime, manga, and chibi themes.",
    provider: "fal",
    themeIds: ["anime", "manga", "chibi", "gacha"],
  },
  {
    badges: ["quality", "aspect-ratio"],
    description:
      "Gemini 2.5 Flash Image via OpenRouter for polished anime output.",
    goal: "quality",
    id: "anime-quality",
    label: "Anime quality",
    model: "google/gemini-2.5-flash-image",
    notes: "Higher fidelity linework and color for seasonal-TV anime looks.",
    provider: "openrouter",
    themeIds: ["anime", "manga", "semi-realistic"],
  },
  {
    badges: ["consistency", "aspect-ratio"],
    description: "OpenAI gpt-image-1 for repeatable character consistency.",
    goal: "consistency",
    id: "max-consistency",
    label: "Max consistency",
    model: "gpt-image-1",
    notes: "Use when prompt adherence and repeatability matter most.",
    provider: "openai",
  },
  {
    badges: ["fast", "aspect-ratio", "negative-prompt"],
    description: "Replicate Flux Schnell — low-cost speed tier.",
    goal: "fast",
    id: "budget-fast",
    label: "Budget fast",
    model: "black-forest-labs/flux-schnell",
    notes: "Good default for experimentation without fal queue latency.",
    provider: "replicate",
  },
  {
    badges: ["quality", "aspect-ratio"],
    description:
      "Native Gemini image model with explicit aspect-ratio control.",
    goal: "quality",
    id: "gemini-direct",
    label: "Gemini direct",
    model: "gemini-2.5-flash-image",
    notes: "Direct Google API — use when you already have a Gemini key.",
    provider: "gemini",
  },
  {
    badges: ["quality", "aspect-ratio"],
    description: "Flux 2 Pro on OpenRouter for premium detail.",
    goal: "quality",
    id: "flux-pro",
    label: "Flux Pro",
    model: "black-forest-labs/flux.2-pro",
    notes: "Heavier model for dark-cinematic and semi-realistic themes.",
    provider: "openrouter",
    themeIds: ["dark-cinematic", "semi-realistic", "3d-render"],
  },
];

export function presetsForProvider(provider: Provider): GenerationPreset[] {
  return GENERATION_PRESETS.filter((preset) => preset.provider === provider);
}

export function presetsForTheme(themeId: string): GenerationPreset[] {
  return GENERATION_PRESETS.filter(
    (preset) =>
      !preset.themeIds ||
      preset.themeIds.length === 0 ||
      preset.themeIds.includes(themeId)
  );
}
