/** Section-level spec comparison for remix lineage diffs. */

import { FIELD_ORDER } from "./data/field-order";
import { SECTION_TITLES } from "./data/paths";
import type { CharacterSpec } from "./schema";
import { formatValue, getPath, isEmpty } from "./utils";

const DIFF_SECTIONS = [
  "meta",
  "identity",
  "personality",
  "archetype",
  "appearance",
  "outfit",
  "magic",
  "pose",
  "framing",
  "setting",
  "props",
  "art",
  "generation",
  "control",
] as const;

const SECTION_TITLE_OVERRIDES: Record<string, string> = {
  control: "Control",
  generation: "Generation",
  meta: "Meta",
};

export type SpecDiffValue = string | boolean | string[] | null;

export interface SpecDiffChange {
  from: SpecDiffValue;
  path: string;
  to: SpecDiffValue;
}

export interface SpecDiffSection {
  changes: SpecDiffChange[];
  sectionKey: string;
  title: string;
}

export interface SpecDiffResult {
  sections: SpecDiffSection[];
}

function sectionTitle(sectionKey: string): string {
  if (sectionKey in SECTION_TITLES) {
    return SECTION_TITLES[sectionKey as keyof typeof SECTION_TITLES];
  }
  return SECTION_TITLE_OVERRIDES[sectionKey] ?? sectionKey;
}

function collectSectionPaths(sectionKey: string): string[] {
  const paths: string[] = [];

  function walk(prefix: string, orderKey: string): void {
    const subKeys = FIELD_ORDER[orderKey as keyof typeof FIELD_ORDER];
    if (!subKeys) {
      paths.push(prefix);
      return;
    }
    for (const subKey of subKeys) {
      const nextPrefix = `${prefix}.${subKey}`;
      const nextOrderKey = `${orderKey}.${subKey}`;
      if (nextOrderKey in FIELD_ORDER) {
        walk(nextPrefix, nextOrderKey);
      } else {
        paths.push(nextPrefix);
      }
    }
  }

  if (sectionKey in FIELD_ORDER) {
    walk(sectionKey, sectionKey);
  }
  return paths;
}

function normalizeDiffValue(value: unknown): SpecDiffValue {
  if (isEmpty(value)) {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  if (typeof value === "string") {
    return value;
  }
  return formatValue(value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (isEmpty(left) && isEmpty(right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

/** Deep-compare two specs section-by-section; `from` is the baseline (parent). */
export function diffSpecs(
  fromSpec: CharacterSpec,
  toSpec: CharacterSpec
): SpecDiffResult {
  const fromRecord = fromSpec as Record<string, unknown>;
  const toRecord = toSpec as Record<string, unknown>;
  const sections: SpecDiffSection[] = [];

  for (const sectionKey of DIFF_SECTIONS) {
    const changes: SpecDiffChange[] = [];

    for (const path of collectSectionPaths(sectionKey)) {
      const fromValue = getPath(fromRecord, path);
      const toValue = getPath(toRecord, path);
      if (valuesEqual(fromValue, toValue)) {
        continue;
      }
      changes.push({
        from: normalizeDiffValue(fromValue),
        path,
        to: normalizeDiffValue(toValue),
      });
    }

    if (changes.length > 0) {
      sections.push({
        changes,
        sectionKey,
        title: sectionTitle(sectionKey),
      });
    }
  }

  return { sections };
}
