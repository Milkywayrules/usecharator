import { describe, expect, test } from "bun:test";
import type { Db } from "@charator/db";
import { recomputeSheetBatchStatus } from "../jobs/sheet-batch";

describe("recomputeSheetBatchStatus", () => {
  test("marks batch failed when all member jobs were deleted", async () => {
    const updates: Record<string, unknown>[] = [];
    const batch = {
      characterId: "char-1",
      createdAt: new Date(),
      finishedAt: null,
      id: "batch-1",
      model: "gpt-image-1",
      preset: "expressions",
      provider: "openai" as const,
      status: "running" as const,
      totalCount: 4,
      userId: "user-1",
      workspaceId: "ws-1",
    };

    let selectPass = 0;
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => {
            selectPass += 1;
            if (selectPass === 1) {
              return Promise.resolve([]);
            }
            return {
              limit: async () => [batch],
            };
          },
        }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          updates.push(values);
          Object.assign(batch, values);
          return {
            where: () => ({
              returning: async () => [batch],
            }),
          };
        },
      }),
    } as unknown as Db;

    const status = await recomputeSheetBatchStatus(mockDb, "batch-1");

    expect(status).toBe("failed");
    expect(batch.status).toBe("failed");
    expect(batch.finishedAt).toBeInstanceOf(Date);
    expect(updates[0]?.status).toBe("failed");
  });
});
