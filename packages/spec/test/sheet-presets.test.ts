import { describe, expect, test } from "bun:test";
import { ENUM_FIELDS } from "../src/data/enums";
import { createEmptySpec } from "../src/empty";
import { characterSpecSchema, parseCharacterSpec } from "../src/schema";
import {
  buildSheetVariants,
  listSheetPresets,
  SHEET_PRESET_IDS,
  sheetVariantCount,
} from "../src/sheet-presets";

describe("sheet presets", () => {
  const baseSpec = createEmptySpec({
    meta: { ...createEmptySpec().meta, name: "Test Hero" },
  });

  for (const presetId of SHEET_PRESET_IDS) {
    test(`${presetId} produces expected variant count`, () => {
      expect(sheetVariantCount(presetId)).toBeGreaterThanOrEqual(4);
      expect(sheetVariantCount(presetId)).toBeLessThanOrEqual(6);
    });

    test(`${presetId} variants are valid specs with locked identity sections`, () => {
      const variants = buildSheetVariants(baseSpec, presetId, "anime");
      expect(variants.length).toBe(sheetVariantCount(presetId));

      for (const variant of variants) {
        expect(() => characterSpecSchema.parse(variant.spec)).not.toThrow();
        expect(variant.prompt.length).toBeGreaterThan(20);
        expect(variant.spec.control.section_modes.identity).toBe("strict");
        expect(variant.spec.control.section_modes.appearance).toBe("strict");
        expect(variant.spec.control.section_modes.outfit).toBe("strict");
        expect(variant.spec.control.locked.length).toBeGreaterThan(0);
      }
    });
  }

  test("expressions preset uses valid expression enums", () => {
    const allowed = new Set(ENUM_FIELDS["pose.expression"]);
    const variants = buildSheetVariants(baseSpec, "expressions", null);
    for (const variant of variants) {
      expect(allowed.has(variant.spec.pose.expression)).toBe(true);
    }
  });

  test("turnaround preset uses valid framing shot enums", () => {
    const allowed = new Set(ENUM_FIELDS["framing.shot"]);
    const variants = buildSheetVariants(baseSpec, "turnaround", null);
    for (const variant of variants) {
      expect(allowed.has(variant.spec.framing.shot)).toBe(true);
    }
  });

  test("poses preset uses valid body enums", () => {
    const allowed = new Set(ENUM_FIELDS["pose.body"]);
    const variants = buildSheetVariants(baseSpec, "poses", null);
    for (const variant of variants) {
      expect(allowed.has(variant.spec.pose.body)).toBe(true);
    }
  });

  test("catalog lists all presets with labels", () => {
    const presets = listSheetPresets();
    expect(presets).toHaveLength(SHEET_PRESET_IDS.length);
    for (const preset of presets) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.variants.every((variant) => variant.label.length > 0)).toBe(
        true
      );
    }
  });

  test("variants do not mutate the base spec", () => {
    const frozen = parseCharacterSpec(baseSpec);
    buildSheetVariants(frozen, "turnaround", "anime");
    expect(frozen.pose.expression).toBe(baseSpec.pose.expression);
  });
});
