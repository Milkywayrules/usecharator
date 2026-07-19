/** Enum and field-kind lookups mirroring schema_registry.py. */

import { ENUM_FIELDS, type EnumPath } from "./data/enums";
import { BOOL_PATHS, FREE_STRING_PATHS, LIST_FREE_PATHS } from "./data/paths";

export function enumForPath(dotPath: string): readonly string[] | undefined {
  return ENUM_FIELDS[dotPath as EnumPath];
}

export function isFreeString(dotPath: string): boolean {
  return FREE_STRING_PATHS.has(dotPath);
}

export function isBoolField(dotPath: string): boolean {
  return BOOL_PATHS.has(dotPath);
}

export function isFreeList(dotPath: string): boolean {
  return LIST_FREE_PATHS.has(dotPath);
}
