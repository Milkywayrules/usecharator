import { describe, expect, test } from "bun:test";
import {
  LEGACY_ROUTE_PREFIX,
  listMountedPaths,
  SHARED_PROGRAMMATIC_ROUTES,
  V1_ONLY_ROUTES,
  V1_ROUTE_PREFIX,
} from "./register";

describe("route mounts", () => {
  test("legacy and v1 share programmatic handlers", () => {
    const legacyPaths = listMountedPaths(LEGACY_ROUTE_PREFIX);
    const v1SharedPaths = SHARED_PROGRAMMATIC_ROUTES.map(
      (route) => `${route.method.toUpperCase()} ${V1_ROUTE_PREFIX}${route.path}`
    );

    for (const path of v1SharedPaths) {
      expect(legacyPaths).toContain(
        path.replace(`${V1_ROUTE_PREFIX}`, LEGACY_ROUTE_PREFIX)
      );
    }
  });

  test("v1-only metadata routes mount under /v1", () => {
    const v1Paths = [
      ...SHARED_PROGRAMMATIC_ROUTES.map(
        (route) =>
          `${route.method.toUpperCase()} ${V1_ROUTE_PREFIX}${route.path}`
      ),
      ...V1_ONLY_ROUTES.map(
        (route) =>
          `${route.method.toUpperCase()} ${V1_ROUTE_PREFIX}${route.path}`
      ),
    ];
    for (const route of V1_ONLY_ROUTES) {
      expect(v1Paths).toContain(
        `${route.method.toUpperCase()} ${V1_ROUTE_PREFIX}${route.path}`
      );
    }
    expect(v1Paths).toContain("GET /v1/providers/capabilities");
    expect(v1Paths).toContain("POST /v1/characters/:id/anchor");
    expect(v1Paths).toContain("DELETE /v1/characters/:id/anchor");
  });
});
