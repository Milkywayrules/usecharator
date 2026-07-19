"use client";

import type { CharacterReportReason } from "@charator/shared";
import { FlagIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reportGalleryCharacter } from "@/lib/api-client";

const REASON_LABELS: Record<CharacterReportReason, string> = {
  inappropriate: "Inappropriate content",
  other: "Other",
  spam: "Spam",
  stolen: "Stolen / unauthorized",
};

interface GalleryReportButtonProps {
  characterId: string;
  isOwner: boolean;
}

export function GalleryReportButton({
  characterId,
  isOwner,
}: GalleryReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CharacterReportReason>("inappropriate");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isOwner) {
    return null;
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await reportGalleryCharacter(characterId, {
        detail: detail.trim() || undefined,
        reason,
      });
      toast.success("Report submitted. Thank you.");
      setOpen(false);
      setDetail("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not submit report";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="default" type="button" variant="outline">
          <FlagIcon />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report character</DialogTitle>
          <DialogDescription>
            Flag content that violates community guidelines. Reports are
            reviewed automatically after multiple submissions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select
              onValueChange={(value) =>
                setReason(value as CharacterReportReason)
              }
              value={reason}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(REASON_LABELS) as [
                    CharacterReportReason,
                    string,
                  ][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Details (optional)</Label>
            <Textarea
              onChange={(event) => setDetail(event.target.value)}
              placeholder="Additional context…"
              rows={3}
              value={detail}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={submitting} onClick={handleSubmit} type="button">
              Submit report
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
