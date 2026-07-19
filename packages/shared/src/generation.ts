import { z } from "zod";
import {
	aspectRatioSchema,
	generationJobStatusSchema,
	providerSchema,
} from "./providers";

export const createGenerationRequestSchema = z
	.object({
		apiKey: z.string().min(1).optional(),
		aspectRatio: aspectRatioSchema.optional(),
		characterId: z.string().uuid().optional(),
		model: z.string().min(1).max(256).optional(),
		negativePrompt: z.string().max(4000).optional(),
		prompt: z.string().min(1).max(8000),
		provider: providerSchema,
		providerKeyId: z.string().uuid().optional(),
		specSnapshot: z.unknown().optional(),
	})
	.refine((value) => Boolean(value.apiKey) !== Boolean(value.providerKeyId), {
		message: "provide exactly one of apiKey or providerKeyId",
		path: ["apiKey"],
	});

export type CreateGenerationRequest = z.infer<
	typeof createGenerationRequestSchema
>;

export const createGenerationResponseSchema = z.object({
	jobId: z.string().uuid(),
});

export type CreateGenerationResponse = z.infer<
	typeof createGenerationResponseSchema
>;

export const generationJobResponseSchema = z.object({
	createdAt: z.string().datetime(),
	error: z.string().nullable(),
	finishedAt: z.string().datetime().nullable(),
	id: z.string().uuid(),
	imageUrls: z.array(z.string().url()).optional(),
	model: z.string(),
	provider: providerSchema,
	startedAt: z.string().datetime().nullable(),
	status: generationJobStatusSchema,
});

export type GenerationJobResponse = z.infer<typeof generationJobResponseSchema>;
