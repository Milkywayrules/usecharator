import {
  type CharacterSpec,
  exportSpecFile,
  type ThemeId,
} from "@charator/spec";

export const MAX_SPEC_FILE_BYTES = 1024 * 1024;

function safeDownloadName(name: string): string {
  const trimmed = name.trim() || "untitled";
  const safe = trimmed.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");
  return (safe || "untitled").slice(0, 80);
}

export function downloadSpecFile(
  spec: CharacterSpec,
  themeId: ThemeId | null
): void {
  const envelope = exportSpecFile(spec, themeId);
  const blob = new Blob([JSON.stringify(envelope, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeDownloadName(spec.meta.name)}.charator.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
