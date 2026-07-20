import { HttpError } from "./errors";

export interface JobAccessContext {
  userId: string;
  workspaceId: string;
}

export function assertWorkspaceScopedJobAccess(
  job: { userId: string | null; workspaceId: string | null },
  authUserId: string | null,
  workspaceContext: JobAccessContext | null
): void {
  if (job.workspaceId) {
    if (
      !workspaceContext ||
      job.workspaceId !== workspaceContext.workspaceId ||
      (job.userId && job.userId !== workspaceContext.userId)
    ) {
      throw new HttpError(403, {
        code: "forbidden",
        message: "job not accessible",
      });
    }
    return;
  }

  if (job.userId && job.userId !== authUserId) {
    throw new HttpError(403, {
      code: "forbidden",
      message: "job not accessible",
    });
  }
}
