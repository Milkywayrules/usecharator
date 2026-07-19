import { describe, expect, test } from "bun:test";
import type { Db, generationJobs } from "@charator/db";
import { markJobFailed, markJobRunning, persistJobImages } from "./processor";

function createMockDb(state: {
  job: typeof generationJobs.$inferSelect | null;
  updates: Record<string, unknown>[];
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
          state.updates.push(values);
          if (state.job) {
            Object.assign(state.job, values);
          }
        },
      }),
    }),
  } as unknown as Db;
}

describe("job state machine", () => {
  test("transitions running jobs to failed via markJobFailed", async () => {
    const job = {
      characterId: null,
      createdAt: new Date(),
      error: null,
      finishedAt: null,
      id: "22222222-2222-2222-2222-222222222222",
      imageKeys: [] as string[],
      model: "fal-ai/flux/dev",
      negativePrompt: null,
      prompt: "test",
      provider: "fal" as const,
      providerJobId: "req-1",
      specSnapshot: null,
      startedAt: new Date(),
      status: "running" as const,
      updatedAt: new Date(),
      userId: null,
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
      characterId: null,
      createdAt: new Date(),
      error: null,
      finishedAt: null,
      id: "33333333-3333-3333-3333-333333333333",
      imageKeys: [] as string[],
      model: "gpt-image-1",
      negativePrompt: null,
      prompt: "test",
      provider: "openai" as const,
      providerJobId: null,
      specSnapshot: null,
      startedAt: null,
      status: "queued" as const,
      updatedAt: new Date(),
      userId: null,
    };

    const db = createMockDb({ job, updates: [] });
    await markJobRunning(db, job.id);
    expect(job.status).toBe("running");
    expect(job.startedAt).toBeInstanceOf(Date);
  });

  test("persistJobImages requires R2 configuration", async () => {
    const job = {
      characterId: null,
      createdAt: new Date(),
      error: null,
      finishedAt: null,
      id: "44444444-4444-4444-4444-444444444444",
      imageKeys: [] as string[],
      model: "gpt-image-1",
      negativePrompt: null,
      prompt: "test",
      provider: "openai" as const,
      providerJobId: null,
      specSnapshot: null,
      startedAt: new Date(),
      status: "running" as const,
      updatedAt: new Date(),
      userId: null,
    };

    const db = createMockDb({ job, updates: [] });
    await expect(
      persistJobImages(db, job.id, [Uint8Array.from([1, 2, 3])])
    ).rejects.toThrow("R2 is not configured");
  });
});
