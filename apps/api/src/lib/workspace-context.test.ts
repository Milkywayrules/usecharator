import { describe, expect, test } from "bun:test";
import {
  resolveBearerWorkspaceId,
  resolveSessionWorkspaceId,
} from "./workspace-context";

describe("resolveSessionWorkspaceId", () => {
  test("prefers owned active organization", () => {
    expect(
      resolveSessionWorkspaceId({
        activeOrganizationId: "ws-active",
        firstOwnedWorkspaceId: "ws-first",
        ownsActiveOrganization: true,
      })
    ).toEqual({ shouldSetActive: false, workspaceId: "ws-active" });
  });

  test("falls back to first owned workspace when active is missing or not owned", () => {
    expect(
      resolveSessionWorkspaceId({
        activeOrganizationId: "ws-stale",
        firstOwnedWorkspaceId: "ws-first",
        ownsActiveOrganization: false,
      })
    ).toEqual({ shouldSetActive: true, workspaceId: "ws-first" });
  });

  test("returns null when user has no owned workspace", () => {
    expect(
      resolveSessionWorkspaceId({
        activeOrganizationId: null,
        firstOwnedWorkspaceId: null,
        ownsActiveOrganization: false,
      })
    ).toEqual({ shouldSetActive: false, workspaceId: null });
  });
});

describe("resolveBearerWorkspaceId", () => {
  test("uses token workspace id", () => {
    expect(resolveBearerWorkspaceId("ws-token")).toBe("ws-token");
  });

  test("returns null when token has no workspace", () => {
    expect(resolveBearerWorkspaceId(undefined)).toBeNull();
  });
});
