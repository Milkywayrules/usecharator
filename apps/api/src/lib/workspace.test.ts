import { describe, expect, test } from "bun:test";
import {
  personalWorkspaceName,
  personalWorkspaceSlug,
  workspaceSlugFromName,
} from "./workspace";

describe("workspace naming helpers", () => {
  test("personal workspace name uses possessive label", () => {
    expect(personalWorkspaceName("Ada")).toBe("Ada's Workspace");
    expect(personalWorkspaceName("  ")).toBe("User's Workspace");
  });

  test("personal workspace slug sanitizes user id", () => {
    expect(personalWorkspaceSlug("user/123")).toBe("personal-user-123");
  });

  test("workspace slug from name lowercases and hyphenates", () => {
    expect(workspaceSlugFromName("My Cool Lab")).toBe("my-cool-lab");
  });
});

describe("assertWorkspaceCreationAllowed", () => {
  test("rejects when owned workspace count meets free tier cap", async () => {
    const { HttpError } = await import("./errors");
    const { assertWorkspaceCreationAllowed } = await import("./workspace");

    let selectCalls = 0;
    const mockDb = {
      select: () => {
        selectCalls += 1;
        if (selectCalls === 1) {
          return {
            from: () => ({
              where: async () => [{ count: 1 }],
            }),
          };
        }
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{ tier: "free" }],
            }),
          }),
        };
      },
    } as never;

    await expect(
      assertWorkspaceCreationAllowed(mockDb, "user-1")
    ).rejects.toThrow(HttpError);
  });
});
