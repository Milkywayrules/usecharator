import { z } from "zod";
import { generationJobStatusSchema, providerSchema } from "./providers";

export const rerollGenerationRequestSchema = z
  .object({
    apiKey: z.string().min(1).optional(),
    providerKeyId: z.string().uuid().optional(),
  })
  .refine(
    (value) => value.apiKey === undefined || value.providerKeyId === undefined,
    {
      message: "provide at most one of apiKey or providerKeyId",
      path: ["apiKey"],
    }
  );

export type RerollGenerationRequest = z.infer<
  typeof rerollGenerationRequestSchema
>;

export const rerollGenerationResponseSchema = z.object({
  jobId: z.string().uuid(),
});

export type RerollGenerationResponse = z.infer<
  typeof rerollGenerationResponseSchema
>;

const TERMINAL_JOB_STATUSES = new Set(["succeeded", "failed"]);

export function isTerminalJobStatus(status: string): boolean {
  return TERMINAL_JOB_STATUSES.has(status);
}

export interface RerollEligibilityInput {
  hasInlineApiKey: boolean;
  hasProviderKeyId: boolean;
  requestUserId: string | null;
  sourceStatus: string;
  sourceUserId: string | null;
}

export type RerollEligibilityResult =
  | { ok: true }
  | { code: string; message: string; ok: false };

export function evaluateRerollEligibility(
  input: RerollEligibilityInput
): RerollEligibilityResult {
  if (!isTerminalJobStatus(input.sourceStatus)) {
    return {
      code: "invalid_state",
      message: "source job is not terminal",
      ok: false,
    };
  }

  if (input.sourceUserId) {
    if (!input.requestUserId || input.requestUserId !== input.sourceUserId) {
      return {
        code: "forbidden",
        message: "job not accessible",
        ok: false,
      };
    }
    if (!(input.hasInlineApiKey || input.hasProviderKeyId)) {
      return {
        code: "invalid_key",
        message: "provider key required",
        ok: false,
      };
    }
    return { ok: true };
  }

  if (!input.hasInlineApiKey) {
    return {
      code: "invalid_key",
      message: "inline api key required for anonymous reroll",
      ok: false,
    };
  }

  return { ok: true };
}

export const characterGenerationHistoryItemSchema = z.object({
  createdAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  id: z.string().uuid(),
  imageUrl: z.string().url().nullable(),
  model: z.string(),
  prompt: z.string(),
  provider: providerSchema,
  status: generationJobStatusSchema,
});

export type CharacterGenerationHistoryItem = z.infer<
  typeof characterGenerationHistoryItemSchema
>;

export const characterGenerationsResponseSchema = z.object({
  hasMore: z.boolean(),
  items: z.array(characterGenerationHistoryItemSchema),
  nextOffset: z.number().int().nonnegative(),
});

export type CharacterGenerationsResponse = z.infer<
  typeof characterGenerationsResponseSchema
>;
