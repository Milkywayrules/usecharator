"use client";

import type { CharacterSpec, ThemeId } from "@charator/spec";
import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadSpecFile } from "@/lib/spec-file-download";

interface ExportSpecButtonProps {
  spec: CharacterSpec;
  themeId: ThemeId | null;
}

export function ExportSpecButton({ spec, themeId }: ExportSpecButtonProps) {
  return (
    <Button
      onClick={() => downloadSpecFile(spec, themeId)}
      size="default"
      type="button"
      variant="outline"
    >
      <DownloadIcon />
      Export JSON
    </Button>
  );
}
