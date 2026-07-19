import { z } from "zod";

export const workspaceListItemSchema = z.object({
  id: z.string(),
  isActive: z.boolean(),
  name: z.string(),
  slug: z.string().nullable(),
});

export type WorkspaceListItem = z.infer<typeof workspaceListItemSchema>;

export const workspaceListResponseSchema = z.object({
  items: z.array(workspaceListItemSchema),
});

export type WorkspaceListResponse = z.infer<typeof workspaceListResponseSchema>;

export const createWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1).max(128),
});

export type CreateWorkspaceRequest = z.infer<
  typeof createWorkspaceRequestSchema
>;

export const workspaceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullable(),
});

export type WorkspaceResponse = z.infer<typeof workspaceResponseSchema>;

export const updateWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1).max(128),
});

export type UpdateWorkspaceRequest = z.infer<
  typeof updateWorkspaceRequestSchema
>;

export const activateWorkspaceResponseSchema = z.object({
  workspaceId: z.string(),
});

export type ActivateWorkspaceResponse = z.infer<
  typeof activateWorkspaceResponseSchema
>;
