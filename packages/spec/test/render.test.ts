import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CharacterSpec,
  effectiveMode,
  renderPrompt,
  shouldIncludeField,
} from "../src/index";
import { parseCharacterSpec } from "../src/schema";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");
const JSON_SUFFIX = /\.json$/;

function loadFixtureJson(name: string): CharacterSpec {
  const raw = readFileSync(join(FIXTURES_DIR, `${name}.json`), "utf-8");
  return parseCharacterSpec(JSON.parse(raw));
}

function loadFixturePrompt(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.prompt.txt`), "utf-8");
}

const FIXTURE_NAMES = readdirSync(FIXTURES_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(JSON_SUFFIX, ""));

describe("renderPrompt Python parity", () => {
  for (const name of FIXTURE_NAMES) {
    test(`${name} is byte-identical to Python renderer`, () => {
      const spec = loadFixtureJson(name);
      const expected = loadFixturePrompt(name);
      const actual = renderPrompt(spec);
      expect(actual).toBe(expected);
    });
  }
});

describe("control mode resolution", () => {
  test("section override wins over global mode", () => {
    const spec = loadFixtureJson("ice-witch-v1");
    spec.control.mode = "strict";
    spec.control.section_modes.appearance = "expressive";
    expect(effectiveMode(spec, "appearance")).toBe("expressive");
    expect(effectiveMode(spec, "identity")).toBe("strict");
  });

  test("strict omits empty and fine-tier fields", () => {
    expect(shouldIncludeField("appearance.hair.bangs", "wild", "strict")).toBe(
      false
    );
    expect(
      shouldIncludeField("appearance.hair.bangs", "wild", "balanced")
    ).toBe(true);
    expect(
      shouldIncludeField("appearance.hair.color", "silver", "strict")
    ).toBe(true);
    expect(shouldIncludeField("appearance.hair.color", "", "strict")).toBe(
      false
    );
    expect(
      shouldIncludeField("appearance.face.facial_hair", "none", "balanced")
    ).toBe(false);
    expect(
      shouldIncludeField("appearance.eyes.heterochromia", false, "balanced")
    ).toBe(false);
  });
});
