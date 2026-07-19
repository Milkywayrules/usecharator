import { generationJobs } from "@charator/db";
import { and, eq } from "drizzle-orm";
import { db } from "../auth";
import { config, r2Configured } from "../config";
import { HttpError } from "../lib/errors";
import { deleteObject } from "../lib/r2";
import { requireWorkspaceContext } from "./workspaces";

async function deleteJobObjectsBestEffort(
  imageKeys: string[],
  referenceImageKeys: string[] | null
): Promise<void> {
  if (!r2Configured(config)) {
    return;
  }
  const keys = [...imageKeys, ...(referenceImageKeys ?? [])];
  await Promise.all(
    keys.map((key) =>
      deleteObject(key).catch((error) => {
        console.warn(`failed to delete R2 object ${key}:`, error);
      })
    )
  );
}

export async function handleGenerationDelete(
  request: Request,
  jobId: string
): Promise<Response> {
  const context = await requireWorkspaceContext(request);

  const [job] = await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);

  if (!job) {
    throw new HttpError(404, { code: "not_found", message: "job not found" });
  }

  if (
    job.userId !== context.user.id ||
    job.workspaceId !== context.workspaceId
  ) {
    throw new HttpError(403, {
      code: "forbidden",
      message: "job not accessible",
    });
  }

  await deleteJobObjectsBestEffort(job.imageKeys, job.referenceImageKeys);

  const deleted = await db
    .delete(generationJobs)
    .where(
      and(
        eq(generationJobs.id, jobId),
        eq(generationJobs.userId, context.user.id),
        eq(generationJobs.workspaceId, context.workspaceId)
      )
    )
    .returning({ id: generationJobs.id });

  if (deleted.length === 0) {
    throw new HttpError(404, { code: "not_found", message: "job not found" });
  }

  return new Response(null, { status: 204 });
}
