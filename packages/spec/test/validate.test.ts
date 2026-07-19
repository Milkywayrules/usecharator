import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	balancedGenerateErrors,
	type CharacterSpec,
	renderPrompt,
	validateSpec,
} from "../src/index";
import { parseCharacterSpec } from "../src/schema";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

const FIXTURE_NAMES = [
	"gojo",
	"ice-witch-v1",
	"ice-witch-v2-tweak",
	"ice-witch-v3",
	"shrine-flame-guardian",
	"zombie-hunter-v1",
];

function loadFixture(name: string): CharacterSpec {
	const raw = readFileSync(join(FIXTURES_DIR, `${name}.json`), "utf-8");
	return parseCharacterSpec(JSON.parse(raw));
}

describe("validateSpec", () => {
	for (const name of FIXTURE_NAMES) {
		test(`${name} fixture validates ok`, () => {
			const spec = loadFixture(name);
			const result = validateSpec(spec);
			expect(result.ok).toBe(true);
			expect(result.errors).toEqual([]);
		});
	}

	test("invalid enum produces dot-path error", () => {
		const spec = loadFixture("ice-witch-v1");
		spec.identity.gender = "invalid_gender" as typeof spec.identity.gender;
		const result = validateSpec(spec);
		expect(result.ok).toBe(false);
		expect(
			result.errors.some((e) => e.includes("invalid enum identity.gender")),
		).toBe(true);
	});

	test("invalid list item produces dot-path error", () => {
		const spec = loadFixture("ice-witch-v1");
		spec.magic.effects = ["not_a_real_effect"];
		const result = validateSpec(spec);
		expect(result.ok).toBe(false);
		expect(
			result.errors.some((e) => e.includes("invalid list item magic.effects")),
		).toBe(true);
	});

	test("missing meta.id fails validation", () => {
		const spec = loadFixture("gojo");
		spec.meta.id = "";
		const result = validateSpec(spec);
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => e.includes("meta.id is required"))).toBe(
			true,
		);
	});

	test("balanced generate guard when too few core fields", () => {
		const spec = loadFixture("gojo");
		spec.control.mode = "balanced";
		const errors = balancedGenerateErrors(spec);
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain("balanced mode: only");
	});
});

describe("theme rendering", () => {
	test("themed render appends theme block and merges negatives", () => {
		const spec = loadFixture("ice-witch-v1");
		const base = renderPrompt(spec);
		const themed = renderPrompt(spec, { theme: "anime" });

		expect(themed.startsWith(base.slice(0, 50))).toBe(true);
		expect(themed).toContain("Theme — anime:");
		expect(themed).toContain("clean anime linework");
		expect(themed).toContain("Avoid:");
		expect(themed).toContain("witch_hat");
		expect(themed).toContain("western comic");
	});

	test("themed render without avoid appends theme block at end", () => {
		const spec = loadFixture("gojo");
		const base = renderPrompt(spec);
		const themed = renderPrompt(spec, { theme: "manga" });
		expect(themed).toContain("Theme — manga:");
		expect(themed.length).toBeGreaterThan(base.length);
	});
});
