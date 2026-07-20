import { describe, expect, test } from "bun:test";
import { HttpError } from "./errors";
import { assertWorkspaceScopedJobAccess } from "./generation-access";

describe("assertWorkspaceScopedJobAccess", () => {
  test("rejects workspace-scoped job when context workspace differs", () => {
    expect(() =>
      assertWorkspaceScopedJobAccess(
        { userId: "user-1", workspaceId: "ws-a" },
        "user-1",
        { userId: "user-1", workspaceId: "ws-b" }
      )
    ).toThrow(HttpError);
  });

  test("allows workspace-scoped job when context matches", () => {
    expect(() =>
      assertWorkspaceScopedJobAccess(
        { userId: "user-1", workspaceId: "ws-a" },
        "user-1",
        { userId: "user-1", workspaceId: "ws-a" }
      )
    ).not.toThrow();
  });

  test("rejects anonymous-owned job for a different user", () => {
    expect(() =>
      assertWorkspaceScopedJobAccess(
        { userId: "user-2", workspaceId: null },
        "user-1",
        null
      )
    ).toThrow(HttpError);
  });

  test("rejects workspace-scoped job without workspace context", () => {
    expect(() =>
      assertWorkspaceScopedJobAccess(
        { userId: "user-1", workspaceId: "ws-a" },
        "user-1",
        null
      )
    ).toThrow(HttpError);
  });
});
