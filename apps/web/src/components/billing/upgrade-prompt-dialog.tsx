"use client";

import {
  TIER_DISPLAY_NAMES,
  type TierId,
  tierLimitErrorSchema,
} from "@charator/shared";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface TierLimitPromptState {
  current: number;
  limit: string;
  message: string;
  tier: TierId;
  upgradeTier: TierId | null;
}

export function parseTierLimitError(
  body: unknown
): TierLimitPromptState | null {
  const parsed = tierLimitErrorSchema.safeParse(body);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

interface UpgradePromptDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  state: TierLimitPromptState | null;
}

export function UpgradePromptDialog({
  onOpenChange,
  open,
  state,
}: UpgradePromptDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plan limit reached</DialogTitle>
          <DialogDescription>
            {state
              ? state.message
              : "You reached a limit on your current plan. Upgrade for more capacity."}
          </DialogDescription>
        </DialogHeader>
        {state ? (
          <p className="text-muted-foreground text-sm">
            Current plan: {TIER_DISPLAY_NAMES[state.tier]}
            {state.upgradeTier
              ? ` · Next tier: ${TIER_DISPLAY_NAMES[state.upgradeTier]}`
              : null}
            {" · "}
            {state.current} used
            {state.limit ? ` (${state.limit})` : ""}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Dismiss
          </Button>
          <Button asChild type="button">
            <Link href="/pricing">View pricing</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
