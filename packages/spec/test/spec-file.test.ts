import { describe, expect, test } from "bun:test";
import { createEmptySpec } from "../src/empty";
import {
  CHARATOR_SPEC_FILE_VERSION,
  exportSpecFile,
  parseSpecFile,
} from "../src/spec-file";
import { SPEC_VERSION } from "../src/validate";

describe("exportSpecFile / parseSpecFile", () => {
  test("roundtrips a valid spec with theme", () => {
    const spec = createEmptySpec();
    spec.meta.name = "Test Hero";
    const envelope = exportSpecFile(spec, "anime");
    const parsed = parseSpecFile(envelope);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.themeId).toBe("anime");
    expect(parsed.spec.meta.name).toBe("Test Hero");
    expect(parsed.spec.spec_version).toBe(SPEC_VERSION);
  });

  test("roundtrips with null themeId", () => {
    const spec = createEmptySpec();
    const parsed = parseSpecFile(exportSpecFile(spec, null));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.themeId).toBeNull();
  });

  test("rejects wrong envelope version", () => {
    const spec = createEmptySpec();
    const parsed = parseSpecFile({
      charator_spec: 99,
      spec,
      specVersion: SPEC_VERSION,
      themeId: null,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.errors[0]).toContain("unsupported charator_spec version");
  });

  test("rejects wrong specVersion", () => {
    const spec = createEmptySpec();
    const parsed = parseSpecFile({
      charator_spec: CHARATOR_SPEC_FILE_VERSION,
      spec,
      specVersion: 1,
      themeId: null,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.errors[0]).toContain("unsupported specVersion");
  });

  test("rejects unknown themeId", () => {
    const spec = createEmptySpec();
    const parsed = parseSpecFile({
      charator_spec: CHARATOR_SPEC_FILE_VERSION,
      spec,
      specVersion: SPEC_VERSION,
      themeId: "not-a-theme",
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.errors.some((error) => error.includes("themeId"))).toBe(true);
  });

  test("rejects invalid character spec", () => {
    const spec = createEmptySpec();
    const broken = {
      ...spec,
      identity: { ...spec.identity, gender: "invalid_gender" },
    };
    const parsed = parseSpecFile({
      charator_spec: CHARATOR_SPEC_FILE_VERSION,
      spec: broken,
      specVersion: SPEC_VERSION,
      themeId: null,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.errors.length).toBeGreaterThan(0);
  });
});
