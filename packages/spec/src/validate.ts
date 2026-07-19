/** Validation — port of acs_lib.validate and balanced_generate_errors. */

import { CORE_PATHS } from "./data/paths";
import { enumForPath, isBoolField, isFreeString } from "./registry";
import type { CharacterSpec } from "./schema";
import { getPath, isEmpty } from "./utils";

export const SPEC_VERSION = 2;

const VALID_MODES = new Set(["strict", "balanced", "expressive"]);
const VALID_SECTION_MODES = new Set([
  "inherit",
  "strict",
  "balanced",
  "expressive",
]);
const ASPECT_RATIOS = new Set(["1:1", "4:3", "3:4", "16:9", "9:16"]);

const LIST_FREE_PATHS = new Set([
  "meta.tags",
  "identity.vibe_keywords",
  "generation.mood_keywords",
  "generation.avoid",
  "control.locked",
]);

const META_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export interface ValidateResult {
  errors: string[];
  ok: boolean;
}

function validateEnumValue(
  dotPath: string,
  value: unknown,
  prefix: string,
  errors: string[]
): void {
  if (isEmpty(value)) {
    return;
  }
  if (isFreeString(dotPath) || isBoolField(dotPath)) {
    return;
  }
  const allowed = enumForPath(dotPath);
  if (allowed === undefined) {
    return;
  }
  if (!allowed.includes(String(value))) {
    errors.push(
      `${prefix}invalid enum ${dotPath}=${JSON.stringify(value)} (allowed: ${[...allowed].sort().join(", ")})`
    );
  }
}

function validateWalk(
  data: unknown,
  dotPath: string,
  prefix: string,
  errors: string[]
): void {
  if (typeof data === "boolean" && isBoolField(dotPath)) {
    return;
  }
  if (
    data !== null &&
    typeof data !== "object" &&
    typeof data !== "string" &&
    typeof data !== "number" &&
    typeof data !== "boolean"
  ) {
    errors.push(`${prefix}${dotPath} has invalid type ${typeof data}`);
    return;
  }
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      const path = dotPath ? `${dotPath}.${key}` : key;
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        validateWalk(value, path, prefix, errors);
      } else if (Array.isArray(value)) {
        if (isEmpty(value)) {
          continue;
        }
        const itemEnum = enumForPath(path);
        if (itemEnum && !LIST_FREE_PATHS.has(path)) {
          for (const item of value) {
            if (!itemEnum.includes(String(item))) {
              errors.push(
                `${prefix}invalid list item ${path}=${JSON.stringify(item)} (allowed: ${[...itemEnum].sort().join(", ")})`
              );
            }
          }
        } else if (path === "personality.secondary") {
          const primary = enumForPath("personality.primary") ?? [];
          for (const item of value) {
            if (!primary.includes(String(item))) {
              errors.push(
                `${prefix}invalid personality.secondary=${JSON.stringify(item)}`
              );
            }
          }
        }
      } else {
        validateEnumValue(path, value, prefix, errors);
      }
    }
  } else if (data !== null && data !== undefined && dotPath) {
    validateEnumValue(dotPath, data, prefix, errors);
  }
}

const VALIDATED_SECTIONS = [
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
  "control",
  "generation",
] as const;

/** Validate a character spec; returns structured errors with dot-path messages. */
export function validateSpec(input: unknown, pathPrefix = ""): ValidateResult {
  const errors: string[] = [];
  const prefix = pathPrefix ? `${pathPrefix}: ` : "";

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { errors: [`${prefix}root must be an object`], ok: false };
  }

  const data = input as Record<string, unknown>;

  if (data.spec_version !== SPEC_VERSION) {
    errors.push(`${prefix}spec_version must be ${SPEC_VERSION}`);
  }

  if (!("control" in data)) {
    errors.push(`${prefix}missing required section: control`);
  }

  const mode = getPath(data, "control.mode");
  if (isEmpty(mode)) {
    errors.push(`${prefix}control.mode is required`);
  } else if (typeof mode !== "string") {
    errors.push(
      `${prefix}control.mode must be strict | balanced | expressive (got ${typeof mode})`
    );
  } else if (!VALID_MODES.has(mode)) {
    errors.push(`${prefix}control.mode must be strict | balanced | expressive`);
  }

  const sectionModes = getPath(data, "control.section_modes");
  if (
    typeof sectionModes === "object" &&
    sectionModes !== null &&
    !Array.isArray(sectionModes)
  ) {
    for (const [key, value] of Object.entries(sectionModes)) {
      if (!(isEmpty(value) || VALID_SECTION_MODES.has(String(value)))) {
        errors.push(`${prefix}control.section_modes.${key} invalid: ${value}`);
      }
    }
  }

  const metaId = getPath(data, "meta.id");
  if (isEmpty(metaId)) {
    errors.push(`${prefix}meta.id is required`);
  } else if (metaId && !META_ID_PATTERN.test(String(metaId))) {
    errors.push(`${prefix}meta.id must be lowercase slug [a-z0-9_-]`);
  }

  const hetero = getPath(data, "appearance.eyes.heterochromia");
  const left = getPath(data, "appearance.eyes.left_color");
  const right = getPath(data, "appearance.eyes.right_color");
  if (hetero === true && (isEmpty(left) || isEmpty(right))) {
    errors.push(
      `${prefix}heterochromia true requires left_color and right_color`
    );
  }
  if (hetero === false && !(isEmpty(left) && isEmpty(right))) {
    errors.push(
      `${prefix}heterochromia false but left/right colors set — set heterochromia true or clear colors`
    );
  }

  const ratio = getPath(data, "generation.aspect_ratio");
  if (!(isEmpty(ratio) || ASPECT_RATIOS.has(String(ratio)))) {
    errors.push(`${prefix}generation.aspect_ratio invalid: ${ratio}`);
  }

  const controlMode = typeof mode === "string" ? mode : "balanced";
  if (controlMode === "strict") {
    for (const dot of CORE_PATHS) {
      if (isEmpty(getPath(data, dot))) {
        errors.push(`${prefix}strict mode: required core field empty: ${dot}`);
      }
    }
  }

  for (const sectionKey of VALIDATED_SECTIONS) {
    const block = data[sectionKey];
    if (typeof block === "object" && block !== null && !Array.isArray(block)) {
      validateWalk(block, sectionKey, prefix, errors);
    }
  }

  return { errors, ok: errors.length === 0 };
}

export function countCoreFilled(spec: CharacterSpec): number {
  return CORE_PATHS.filter(
    (dot) => !isEmpty(getPath(spec as Record<string, unknown>, dot))
  ).length;
}

/** Balanced-mode generate guard — mirrors acs_lib.balanced_generate_errors. */
export function balancedGenerateErrors(
  spec: CharacterSpec,
  pathPrefix = ""
): string[] {
  const mode = getPath(spec as Record<string, unknown>, "control.mode");
  if (mode !== "balanced") {
    return [];
  }
  const filledCore = countCoreFilled(spec);
  if (filledCore < 5) {
    const prefix = pathPrefix ? `${pathPrefix}: ` : "";
    return [
      `${prefix}balanced mode: only ${filledCore}/${CORE_PATHS.length} core fields filled — add more fields or switch to expressive before generate`,
    ];
  }
  return [];
}

/** Full validation including balanced generate guard. */
export function validateSpecForGenerate(
  input: unknown,
  pathPrefix = ""
): ValidateResult {
  const base = validateSpec(input, pathPrefix);
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    const genErrors = balancedGenerateErrors(
      input as CharacterSpec,
      pathPrefix
    );
    const errors = [...base.errors, ...genErrors];
    return { errors, ok: errors.length === 0 };
  }
  return base;
}
