"use client";

import type { CharacterSpec, ThemeId } from "@charator/spec";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookmarkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createCharacter } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { saveLocalCharacter } from "@/lib/local-characters";
import { themeIdForRequest } from "@/lib/theme-id";

interface SaveToLibraryButtonProps {
  spec: CharacterSpec;
  themeId: ThemeId | null;
}

export function SaveToLibraryButton({
  spec,
  themeId,
}: SaveToLibraryButtonProps) {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const name = spec.meta.name.trim() || "Untitled character";
      if (signedIn) {
        await createCharacter({
          name,
          spec,
          visibility: "private",
          ...themeIdForRequest(themeId),
        });
        return;
      }
      await saveLocalCharacter({
        id: spec.meta.id || crypto.randomUUID(),
        name,
        spec,
        themeId,
        updatedAt: new Date().toISOString(),
      });
    },
    onError: () => toast.error("Could not save character"),
    onSuccess: async () => {
      toast.success(signedIn ? "Saved to your account" : "Saved locally");
      if (signedIn) {
        await queryClient.invalidateQueries({ queryKey: ["characters"] });
      }
    },
  });

  return (
    <Button
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      type="button"
      variant="outline"
    >
      <BookmarkIcon />
      Save to library
    </Button>
  );
}
