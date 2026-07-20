"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  parseTierLimitError,
  type TierLimitPromptState,
  UpgradePromptDialog,
} from "@/components/billing/upgrade-prompt-dialog";

type ShowTierLimitPrompt = (body: unknown) => boolean;

const TierLimitPromptContext = createContext<ShowTierLimitPrompt>(() => false);

export function useTierLimitPrompt(): ShowTierLimitPrompt {
  return useContext(TierLimitPromptContext);
}

export function tierLimitBodyFromError(error: unknown): unknown {
  if (error && typeof error === "object" && "body" in error) {
    return (error as { body?: unknown }).body;
  }
  return null;
}

export function TierLimitPromptProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TierLimitPromptState | null>(null);

  const showFromErrorBody = useCallback<ShowTierLimitPrompt>((body) => {
    const parsed = parseTierLimitError(body);
    if (!parsed) {
      return false;
    }
    setState(parsed);
    setOpen(true);
    return true;
  }, []);

  const value = useMemo(() => showFromErrorBody, [showFromErrorBody]);

  return (
    <TierLimitPromptContext.Provider value={value}>
      {children}
      <UpgradePromptDialog onOpenChange={setOpen} open={open} state={state} />
    </TierLimitPromptContext.Provider>
  );
}
