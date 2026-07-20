"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CloudUploadIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createCharacter } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { themeIdForRequest } from "@/lib/theme-id";
import { useWizardStore } from "@/stores/wizard-store";

function hasWizardDraft(spec: { meta?: { name?: string } }): boolean {
  return Boolean(spec.meta?.name?.trim());
}

export function WizardDraftPromotion() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);
  const spec = useWizardStore((state) => state.spec);
  const themeId = useWizardStore((state) => state.themeId);
  const reset = useWizardStore((state) => state.reset);
  const queryClient = useQueryClient();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = spec.meta.name.trim() || "Untitled Character";
      return createCharacter({
        name,
        spec,
        visibility: "private",
        ...themeIdForRequest(themeId),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSuccess: (character) => {
      reset();
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      toast.success(`Saved "${character.name}" to your library`);
    },
  });

  if (!signedIn || !hydrated || !hasWizardDraft(spec)) {
    return null;
  }

  return (
    <div
      className="border-b bg-primary/5 px-4 py-3"
      data-testid="wizard-draft-promotion"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-sm">Local wizard draft found</p>
          <p className="text-muted-foreground text-xs">
            Save &quot;{spec.meta.name.trim()}&quot; to your cloud library in
            one click.
          </p>
        </div>
        <Button
          className="h-8"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          type="button"
        >
          <CloudUploadIcon />
          Save draft to cloud
        </Button>
      </div>
    </div>
  );
}
