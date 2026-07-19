export function resolveSessionWorkspaceId(input: {
  activeOrganizationId: string | null;
  firstOwnedWorkspaceId: string | null;
  ownsActiveOrganization: boolean;
}): { shouldSetActive: boolean; workspaceId: string | null } {
  if (input.activeOrganizationId && input.ownsActiveOrganization) {
    return {
      shouldSetActive: false,
      workspaceId: input.activeOrganizationId,
    };
  }

  if (input.firstOwnedWorkspaceId) {
    return {
      shouldSetActive: true,
      workspaceId: input.firstOwnedWorkspaceId,
    };
  }

  return { shouldSetActive: false, workspaceId: null };
}

export function resolveBearerWorkspaceId(
  workspaceId: string | undefined
): string | null {
  return workspaceId ?? null;
}
