"use client";

import { parseSpecFile } from "@charator/spec";
import { UploadIcon } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_SPEC_FILE_BYTES } from "@/lib/spec-file-download";
import { useWizardStore } from "@/stores/wizard-store";

interface ImportSpecButtonProps {
  className?: string;
  onImported?: () => void;
  variant?: "default" | "outline";
}

export function ImportSpecButton({
  className,
  onImported,
  variant = "outline",
}: ImportSpecButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const loadDraft = useWizardStore((state) => state.loadDraft);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (file.size > MAX_SPEC_FILE_BYTES) {
      toast.error("File is too large (max 1 MB)");
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(await file.text());
    } catch {
      toast.error("Invalid JSON file");
      return;
    }

    const result = parseSpecFile(parsedJson);
    if (!result.ok) {
      toast.error(result.errors[0] ?? "Invalid character file");
      return;
    }

    loadDraft(result.spec, result.themeId);
    onImported?.();
    toast.success("Character imported — continue in the wizard");
  }

  return (
    <>
      <input
        accept=".json,application/json"
        aria-hidden
        className="hidden"
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
      <Button
        className={className}
        onClick={() => inputRef.current?.click()}
        type="button"
        variant={variant}
      >
        <UploadIcon />
        Import JSON
      </Button>
    </>
  );
}
