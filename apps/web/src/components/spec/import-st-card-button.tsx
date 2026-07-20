"use client";

import type { StCardImportResponse, StCardLossyField } from "@charator/shared";
import { MAX_ST_CARD_PNG_BYTES } from "@charator/spec";
import { UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { importStCard } from "@/lib/api-client";
import { useWizardStore } from "@/stores/wizard-store";

interface ImportStCardButtonProps {
  className?: string;
  onImported?: () => void;
  variant?: "default" | "outline";
}

export function ImportStCardButton({
  className,
  onImported,
  variant = "outline",
}: ImportStCardButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const loadDraft = useWizardStore((state) => state.loadDraft);
  const [pending, setPending] = useState<StCardImportResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (file.size > MAX_ST_CARD_PNG_BYTES) {
      toast.error("File is too large (max 10 MB)");
      return;
    }

    setLoading(true);
    try {
      const result = await importStCard(file);
      setPending(result);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not import SillyTavern card"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleAcceptImport() {
    if (!pending) {
      return;
    }
    loadDraft(pending.spec as Parameters<typeof loadDraft>[0], null);
    setPending(null);
    onImported?.();
    toast.success(
      "SillyTavern card imported — review the draft before publishing"
    );
  }

  return (
    <>
      <input
        accept=".json,.png,application/json,image/png"
        aria-hidden
        className="hidden"
        data-testid="st-card-file-input"
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
      <Button
        className={className}
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        type="button"
        variant={variant}
      >
        <UploadIcon />
        Import SillyTavern card
      </Button>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
          }
        }}
        open={pending !== null}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review imported card</DialogTitle>
            <DialogDescription>
              This SillyTavern card was mapped into a Chara Tor draft. Review
              required fields before continuing — nothing is published to the
              gallery automatically.
            </DialogDescription>
          </DialogHeader>

          {pending ? (
            <div className="space-y-4 text-sm">
              <p>
                Source format:{" "}
                <span className="font-medium">{pending.sourceFormat}</span>
              </p>
              {pending.reviewRequired ? (
                <LossyFieldsList fields={pending.lossyFields} />
              ) : (
                <p className="text-muted-foreground">
                  Lossless round-trip via embedded Chara Tor spec — minimal
                  review needed.
                </p>
              )}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              onClick={() => setPending(null)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button onClick={handleAcceptImport} type="button">
              Accept into wizard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LossyFieldsList({ fields }: { fields: StCardLossyField[] }) {
  if (fields.length === 0) {
    return (
      <p className="text-muted-foreground">No field mapping notes recorded.</p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="font-medium">Review required — mapped fields</p>
      <ul
        className="max-h-60 space-y-2 overflow-y-auto rounded-md border p-3 text-muted-foreground"
        data-testid="st-card-lossy-fields"
      >
        {fields.map((entry) => (
          <li key={`${entry.field}-${entry.destination}`}>
            <span className="font-medium text-foreground">{entry.field}</span>
            {" → "}
            {entry.destination}
          </li>
        ))}
      </ul>
    </div>
  );
}
