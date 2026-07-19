import { z } from "zod";
import {
  aspectRatioSchema,
  generationJobStatusSchema,
  providerSchema,
} from "./providers";
import {
  referenceJobImageSchema,
  referenceStrengthSchema,
} from "./reference-images";

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
    referenceImageDataUrl: z.string().min(1).optional(),
    referenceJobImage: referenceJobImageSchema.optional(),
    referenceStrength: referenceStrengthSchema.optional(),
    specSnapshot: z.unknown().optional(),
    useCharacterAnchor: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.apiKey) !== Boolean(value.providerKeyId), {
    message: "provide exactly one of apiKey or providerKeyId",
    path: ["apiKey"],
  })
  .refine(
    (value) =>
      !(
        value.useCharacterAnchor &&
        (value.referenceJobImage || value.referenceImageDataUrl)
      ),
    {
      message:
        "useCharacterAnchor cannot be combined with referenceJobImage or referenceImageDataUrl",
      path: ["useCharacterAnchor"],
    }
  )
  .refine(
    (value) => !(value.referenceJobImage && value.referenceImageDataUrl),
    {
      message: "provide only one of referenceJobImage or referenceImageDataUrl",
      path: ["referenceJobImage"],
    }
  );

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
  characterId: z.string().uuid().nullable().optional(),
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
