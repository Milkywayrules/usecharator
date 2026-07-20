import { z } from "zod";

export const onboardingStepIdSchema = z.enum([
  "has_provider_key",
  "has_character",
  "has_generation",
]);

export type OnboardingStepId = z.infer<typeof onboardingStepIdSchema>;

export const onboardingStepSchema = z.object({
  done: z.boolean(),
  id: onboardingStepIdSchema,
  label: z.string(),
});

export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

export const onboardingResponseSchema = z.object({
  activatedAt: z.string().datetime().nullable(),
  progress: z.number().int().min(0).max(100),
  steps: z.array(onboardingStepSchema),
});

export type OnboardingResponse = z.infer<typeof onboardingResponseSchema>;

export const seedDemoCharacterResponseSchema = z.object({
  characterId: z.string().uuid().nullable(),
  created: z.boolean(),
});

export type SeedDemoCharacterResponse = z.infer<
  typeof seedDemoCharacterResponseSchema
>;
