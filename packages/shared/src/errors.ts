import { z } from "zod";

export const apiErrorSchema = z.object({
	code: z.string(),
	message: z.string(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export function apiError(code: string, message: string): ApiError {
	return { code, message };
}
