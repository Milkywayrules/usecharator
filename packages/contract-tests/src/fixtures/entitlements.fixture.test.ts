import { describe, expect, test } from "bun:test";
import { entitlementsUsageSchema } from "@charator/shared";
import { entitlementsUsagePactBody } from "./entitlements";

describe("entitlements pact fixtures", () => {
  test("usage fixture covers entitlementsUsageSchema keys", () => {
    const schemaKeys = Object.keys(entitlementsUsageSchema.shape).sort();
    const fixtureKeys = Object.keys(entitlementsUsagePactBody).sort();
    expect(fixtureKeys).toEqual(schemaKeys);
  });
});
