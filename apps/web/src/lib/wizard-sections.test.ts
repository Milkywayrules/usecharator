import { expect, test } from "bun:test";
import {
  getControlFields,
  getFieldsForSection,
  WIZARD_STEPS,
} from "./wizard-sections";

test("wizard steps include theme control and review", () => {
  const ids = WIZARD_STEPS.map((step) => step.id);
  expect(ids).toContain("theme");
  expect(ids).toContain("control");
  expect(ids).toContain("review");
  expect(ids.at(-1)).toBe("review");
});

test("section fields exclude control paths from catalog sections", () => {
  const metaFields = getFieldsForSection("meta");
  expect(metaFields.every((field) => field.path.startsWith("meta."))).toBe(
    true
  );

  const controlFields = getControlFields();
  expect(
    controlFields.every((field) => field.path.startsWith("control."))
  ).toBe(true);
});
