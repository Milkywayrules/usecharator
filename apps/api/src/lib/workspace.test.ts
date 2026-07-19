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

describe("workspace delete guard seam", () => {
  test("assertWorkspaceCreationAllowed is a no-op entitlement seam", async () => {
    const { assertWorkspaceCreationAllowed } = await import("./workspace");
    await expect(
      Promise.resolve(assertWorkspaceCreationAllowed({} as never, "user-1"))
    ).resolves.toBeUndefined();
  });
});
