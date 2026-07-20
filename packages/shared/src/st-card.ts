import { z } from "zod";

export const stCardSourceFormatSchema = z.enum([
  "ccv3-json",
  "ccv3-png",
  "ccv2-json",
  "ccv2-png",
]);

export type StCardSourceFormat = z.infer<typeof stCardSourceFormatSchema>;

export const stCardLossyFieldSchema = z.object({
  destination: z.string(),
  field: z.string(),
});

export type StCardLossyField = z.infer<typeof stCardLossyFieldSchema>;

export const stCardImportResponseSchema = z.object({
  lossyFields: z.array(stCardLossyFieldSchema),
  reviewRequired: z.boolean(),
  sourceFormat: stCardSourceFormatSchema,
  spec: z.unknown(),
});

export type StCardImportResponse = z.infer<typeof stCardImportResponseSchema>;

export const stCardExportJsonResponseSchema = z.object({
  card: z.unknown(),
  format: z.literal("json"),
  message: z.string(),
});

export type StCardExportJsonResponse = z.infer<
  typeof stCardExportJsonResponseSchema
>;
