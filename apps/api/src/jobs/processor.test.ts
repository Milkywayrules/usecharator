import { describe, expect, test } from "bun:test";
import type { Db, generationJobs } from "@charator/db";
import { markJobFailed, markJobRunning, persistJobImages } from "./processor";

function createMockDb(state: {
  job: typeof generationJobs.$inferSelect | null;
  updates: Record<string, unknown>[];
  guardActiveStatus?: boolean;
}) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (state.job ? [state.job] : []),
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          const skipped =
            state.guardActiveStatus &&
            state.job &&
            !["queued", "running"].includes(state.job.status);

          if (!skipped) {
            state.updates.push(values);
            if (state.job) {
              Object.assign(state.job, values);
            }
          }

          return {
            returning: async () => (skipped || !state.job ? [] : [state.job]),
          };
        },
      }),
    }),
  } as unknown as Db;
}

const baseJobFields = {
  characterId: null,
  createdAt: new Date(),
  error: null,
  finishedAt: null,
  imageKeys: [] as string[],
  negativePrompt: null,
  providerKeyId: null,
  specSnapshot: null,
  userId: null,
};

describe("job state machine", () => {
  test("transitions running jobs to failed via markJobFailed", async () => {
    const job = {
      ...baseJobFields,
      id: "22222222-2222-2222-2222-222222222222",
      model: "fal-ai/flux/dev",
      prompt: "test",
      provider: "fal" as const,
      providerJobId: "req-1",
      startedAt: new Date(),
      status: "running" as const,
      updatedAt: new Date(),
    };

    const updates: Record<string, unknown>[] = [];
    const db = createMockDb({ job, updates });

    await markJobFailed(db, job.id, "provider timeout");

    expect(job.status).toBe("failed");
    expect(job.error).toBe("provider timeout");
    expect(job.finishedAt).toBeInstanceOf(Date);
  });

  test("markJobRunning sets startedAt", async () => {
    const job = {
      ...baseJobFields,
      id: "33333333-3333-3333-3333-333333333333",
      model: "gpt-image-1",
      prompt: "test",
      provider: "openai" as const,
      providerJobId: null,
      startedAt: null,
      status: "queued" as const,
      updatedAt: new Date(),
    };

    const db = createMockDb({ job, updates: [] });
    await markJobRunning(db, job.id);
    expect(job.status).toBe("running");
    expect(job.startedAt).toBeInstanceOf(Date);
  });

  test("persistJobImages requires R2 configuration", async () => {
    const job = {
      ...baseJobFields,
      id: "44444444-4444-4444-4444-444444444444",
      model: "gpt-image-1",
      prompt: "test",
      provider: "openai" as const,
      providerJobId: null,
      startedAt: new Date(),
      status: "running" as const,
      updatedAt: new Date(),
    };

    const db = createMockDb({ job, updates: [] });
    await expect(
      persistJobImages(db, job.id, [Uint8Array.from([1, 2, 3])])
    ).rejects.toThrow("R2 is not configured");
  });

  test("markJobFailed skips jobs already in a terminal status", async () => {
    const job = {
      ...baseJobFields,
      error: null,
      finishedAt: new Date(),
      id: "55555555-5555-5555-5555-555555555555",
      model: "fal-ai/flux/dev",
      prompt: "test",
      provider: "fal" as const,
      providerJobId: "req-2",
      startedAt: new Date(),
      status: "succeeded" as const,
      updatedAt: new Date(),
    };

    const updates: Record<string, unknown>[] = [];
    const db = createMockDb({ guardActiveStatus: true, job, updates });

    await markJobFailed(db, job.id, "late webhook failure");

    expect(updates).toHaveLength(0);
    expect(job.status).toBe("succeeded");
  });
});
