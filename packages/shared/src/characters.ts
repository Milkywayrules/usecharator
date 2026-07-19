import { z } from "zod";
import { characterVisibilitySchema } from "./providers";

export const createCharacterRequestSchema = z.object({
	name: z.string().min(1).max(120),
	spec: z.unknown(),
	visibility: characterVisibilitySchema.default("public"),
});

export type CreateCharacterRequest = z.infer<
	typeof createCharacterRequestSchema
>;

export const updateCharacterRequestSchema = z
	.object({
		name: z.string().min(1).max(120).optional(),
		spec: z.unknown().optional(),
		visibility: characterVisibilitySchema.optional(),
	})
	.refine(
		(value) =>
			value.name !== undefined ||
			value.spec !== undefined ||
			value.visibility !== undefined,
		{ message: "at least one field required" },
	);

export type UpdateCharacterRequest = z.infer<
	typeof updateCharacterRequestSchema
>;

export const characterResponseSchema = z.object({
	createdAt: z.string().datetime(),
	id: z.string().uuid(),
	name: z.string(),
	spec: z.unknown(),
	updatedAt: z.string().datetime(),
	visibility: characterVisibilitySchema,
});

export type CharacterResponse = z.infer<typeof characterResponseSchema>;
