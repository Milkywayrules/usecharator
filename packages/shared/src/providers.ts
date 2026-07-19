import { z } from "zod";

export const providerSchema = z.enum([
	"openrouter",
	"openai",
	"gemini",
	"fal",
	"replicate",
	"custom",
]);

export type Provider = z.infer<typeof providerSchema>;

export const generationJobStatusSchema = z.enum([
	"queued",
	"running",
	"succeeded",
	"failed",
]);

export type GenerationJobStatus = z.infer<typeof generationJobStatusSchema>;

export const characterVisibilitySchema = z.enum(["public", "private"]);

export type CharacterVisibility = z.infer<typeof characterVisibilitySchema>;

export const aspectRatioSchema = z.enum(["1:1", "3:4", "4:3", "16:9", "9:16"]);

export type AspectRatio = z.infer<typeof aspectRatioSchema>;

/** Default model slug per provider — client may override. */
export const providerModelDefaults: Record<Provider, string> = {
	custom: "dall-e-3",
	fal: "fal-ai/flux/dev",
	gemini: "gemini-2.5-flash-image",
	openai: "gpt-image-1",
	openrouter: "google/gemini-2.5-flash-image",
	replicate: "black-forest-labs/flux-schnell",
};

export const providerModelOptions: Record<
	Provider,
	{ label: string; models: { id: string; label: string }[] }
> = {
	custom: {
		label: "Custom (OpenAI-compatible)",
		models: [{ id: "dall-e-3", label: "Default image model" }],
	},
	fal: {
		label: "fal.ai",
		models: [
			{ id: "fal-ai/flux/dev", label: "Flux Dev" },
			{ id: "fal-ai/flux/schnell", label: "Flux Schnell" },
		],
	},
	gemini: {
		label: "Google Gemini",
		models: [
			{ id: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image" },
			{ id: "gemini-3.1-flash-image", label: "Gemini 3.1 Flash Image" },
		],
	},
	openai: {
		label: "OpenAI",
		models: [{ id: "gpt-image-1", label: "GPT Image 1" }],
	},
	openrouter: {
		label: "OpenRouter",
		models: [
			{ id: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image" },
			{ id: "black-forest-labs/flux.2-pro", label: "Flux 2 Pro" },
		],
	},
	replicate: {
		label: "Replicate",
		models: [
			{
				id: "black-forest-labs/flux-schnell",
				label: "Flux Schnell",
			},
		],
	},
};
