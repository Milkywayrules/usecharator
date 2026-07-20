import { FIELD_CATALOG, humanize } from "@charator/spec";

const labelByPath = new Map(
  FIELD_CATALOG.map((entry) => [entry.path, entry.label])
);

/** Readable label for a spec field path (catalog label or humanized leaf). */
export function fieldLabelForPath(path: string): string {
  const catalogLabel = labelByPath.get(path);
  if (catalogLabel) {
    return catalogLabel;
  }
  const leaf = path.split(".").pop() ?? path;
  return humanize(leaf);
}

/** Display a spec diff value for UI rows. */
export function formatSpecDiffValue(
  value: string | boolean | string[] | null
): string {
  if (value === null) {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "—";
  }
  return value.trim() ? value : "—";
}
