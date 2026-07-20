import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { diffSpecs } from "../src/diff";
import { type CharacterSpec, parseCharacterSpec } from "../src/index";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

function loadFixture(name: string): CharacterSpec {
  return parseCharacterSpec(
    JSON.parse(readFileSync(join(FIXTURES_DIR, `${name}.json`), "utf8"))
  );
}

describe("diffSpecs", () => {
  test("returns empty sections for identical specs", () => {
    const spec = loadFixture("gojo");
    expect(diffSpecs(spec, spec)).toEqual({ sections: [] });
  });

  test("detects a single-field change", () => {
    const parent = loadFixture("gojo");
    const child = structuredClone(parent);
    child.identity.gender = "male";

    const result = diffSpecs(parent, child);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.sectionKey).toBe("identity");
    expect(result.sections[0]?.changes).toEqual([
      {
        from: null,
        path: "identity.gender",
        to: "male",
      },
    ]);
  });

  test("detects changes across multiple sections", () => {
    const parent = loadFixture("gojo");
    const child = structuredClone(parent);
    child.identity.gender = "female";
    child.pose.expression = "smirk";

    const result = diffSpecs(parent, child);
    const keys = result.sections.map((section) => section.sectionKey);
    expect(keys).toContain("identity");
    expect(keys).toContain("pose");
    expect(result.sections).toHaveLength(2);
  });

  test("treats added optional fields as changes from empty", () => {
    const parent = loadFixture("gojo");
    const child = structuredClone(parent);
    child.meta.notes = "remix notes";

    const result = diffSpecs(parent, child);
    expect(result.sections).toEqual([
      {
        changes: [
          {
            from: null,
            path: "meta.notes",
            to: "remix notes",
          },
        ],
        sectionKey: "meta",
        title: "Meta",
      },
    ]);
  });

  test("treats removed optional fields as changes to empty", () => {
    const parent = loadFixture("gojo");
    const child = structuredClone(parent);
    parent.meta.inspiration = "source material";
    child.meta.inspiration = "";

    const result = diffSpecs(parent, child);
    const meta = result.sections.find(
      (section) => section.sectionKey === "meta"
    );
    expect(
      meta?.changes.some((change) => change.path === "meta.inspiration")
    ).toBe(true);
    const inspirationChange = meta?.changes.find(
      (change) => change.path === "meta.inspiration"
    );
    expect(inspirationChange?.to).toBeNull();
    expect(inspirationChange?.from).toBe("source material");
  });
});
