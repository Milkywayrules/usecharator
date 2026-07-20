"use client";

import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportStCard } from "@/lib/api-client";

interface ExportStCardButtonProps {
  characterId: string;
  characterName: string;
  className?: string;
  variant?: "default" | "outline";
}

function safeDownloadName(name: string): string {
  const trimmed = name.trim() || "untitled";
  const safe = trimmed.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");
  return (safe || "untitled").slice(0, 80);
}

export function ExportStCardButton({
  characterId,
  characterName,
  className,
  variant = "outline",
}: ExportStCardButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const result = await exportStCard(characterId);
      if (result.kind === "png") {
        const url = URL.createObjectURL(result.blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${safeDownloadName(characterName)}-st-card.png`;
        anchor.click();
        URL.revokeObjectURL(url);
        toast.success("SillyTavern card PNG downloaded");
        return;
      }

      const blob = new Blob([JSON.stringify(result.card, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeDownloadName(characterName)}-st-card.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.message(result.message);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not export SillyTavern card"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      className={className}
      data-testid="export-st-card-button"
      disabled={loading}
      onClick={handleExport}
      type="button"
      variant={variant}
    >
      <DownloadIcon />
      Export SillyTavern card
    </Button>
  );
}
