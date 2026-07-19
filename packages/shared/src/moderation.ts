import { z } from "zod";
import type { CharacterVisibility } from "./providers";

export const characterReportReasonSchema = z.enum([
  "inappropriate",
  "spam",
  "stolen",
  "other",
]);

export type CharacterReportReason = z.infer<typeof characterReportReasonSchema>;

export const moderationStatusSchema = z.enum(["visible", "hidden"]);

export type ModerationStatus = z.infer<typeof moderationStatusSchema>;

export const reportCharacterRequestSchema = z.object({
  detail: z.string().max(2000).optional(),
  reason: characterReportReasonSchema,
});

export type ReportCharacterRequest = z.infer<
  typeof reportCharacterRequestSchema
>;

export const reportCharacterResponseSchema = z.object({
  hidden: z.boolean(),
  reportId: z.string().uuid(),
});

export type ReportCharacterResponse = z.infer<
  typeof reportCharacterResponseSchema
>;

/** Hide character once report count reaches this threshold. */
export const MODERATION_HIDE_THRESHOLD = 5;

export function shouldHideCharacter(
  reportCount: number,
  threshold = MODERATION_HIDE_THRESHOLD
): boolean {
  return reportCount >= threshold;
}

export function canRemixCharacter(input: {
  moderationStatus: ModerationStatus;
  ownerUserId: string;
  viewerUserId: string;
  visibility: CharacterVisibility;
}): boolean {
  const isOwner = input.ownerUserId === input.viewerUserId;
  return (
    isOwner ||
    (input.visibility === "public" && input.moderationStatus === "visible")
  );
}
