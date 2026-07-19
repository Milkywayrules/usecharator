import { z } from "zod";
import { generationJobStatusSchema, providerSchema } from "./providers";

export const sheetPresetIdSchema = z.enum([
  "turnaround",
  "expressions",
  "poses",
]);

export type SheetPresetId = z.infer<typeof sheetPresetIdSchema>;

export const sheetBatchStatusSchema = z.enum([
  "running",
  "completed",
  "partial",
  "failed",
]);

export type SheetBatchStatus = z.infer<typeof sheetBatchStatusSchema>;

export const createSheetRequestSchema = z
  .object({
    apiKey: z.string().min(1).optional(),
    model: z.string().min(1).max(256).optional(),
    preset: sheetPresetIdSchema,
    provider: providerSchema,
    providerKeyId: z.string().uuid().optional(),
    useAnchor: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.apiKey) !== Boolean(value.providerKeyId), {
    message: "provide exactly one of apiKey or providerKeyId",
    path: ["apiKey"],
  });

export type CreateSheetRequest = z.infer<typeof createSheetRequestSchema>;

export const createSheetResponseSchema = z.object({
  batchId: z.string().uuid(),
  estimatedCalls: z.number().int().positive(),
  jobIds: z.array(z.string().uuid()),
});

export type CreateSheetResponse = z.infer<typeof createSheetResponseSchema>;

export const sheetVariantJobSchema = z.object({
  error: z.string().nullable(),
  imageUrls: z.array(z.string().url()).optional(),
  jobId: z.string().uuid(),
  label: z.string(),
  status: generationJobStatusSchema,
  variantId: z.string(),
});

export type SheetVariantJob = z.infer<typeof sheetVariantJobSchema>;

export const sheetBatchResponseSchema = z.object({
  batchId: z.string().uuid(),
  characterId: z.string().uuid(),
  createdAt: z.string().datetime(),
  estimatedCalls: z.number().int().positive(),
  finishedAt: z.string().datetime().nullable(),
  model: z.string(),
  preset: sheetPresetIdSchema,
  provider: providerSchema,
  status: sheetBatchStatusSchema,
  variants: z.array(sheetVariantJobSchema),
});

export type SheetBatchResponse = z.infer<typeof sheetBatchResponseSchema>;

export const SHEET_CONCURRENCY_PER_USER = 2;

const TERMINAL_JOB_STATUSES = new Set(["succeeded", "failed"]);

export function isTerminalJobStatusForBatch(status: string): boolean {
  return TERMINAL_JOB_STATUSES.has(status);
}

export interface BatchMemberStatusInput {
  status: string;
}

/** Derive batch status from member job terminal states. */
export function deriveSheetBatchStatus(
  members: BatchMemberStatusInput[]
): SheetBatchStatus {
  if (members.length === 0) {
    return "failed";
  }

  const terminal = members.filter((member) =>
    isTerminalJobStatusForBatch(member.status)
  );
  if (terminal.length < members.length) {
    return "running";
  }

  const succeeded = members.filter((member) => member.status === "succeeded");
  if (succeeded.length === members.length) {
    return "completed";
  }
  if (succeeded.length === 0) {
    return "failed";
  }
  return "partial";
}

/** How many queued sheet jobs may start given running count and cap. */
export function sheetDispatchSlots(
  runningCount: number,
  cap = SHEET_CONCURRENCY_PER_USER
): number {
  return Math.max(0, cap - runningCount);
}
