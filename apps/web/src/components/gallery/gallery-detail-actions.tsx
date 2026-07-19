"use client";

import type { GalleryDetailResponse } from "@charator/shared";
import { parseCharacterSpec } from "@charator/spec";
import { ShuffleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { patchCharacter, remixCharacter } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { normalizeThemeId } from "@/lib/theme-id";
import { useWizardStore } from "@/stores/wizard-store";

interface GalleryDetailActionsProps {
  detail: GalleryDetailResponse;
}

export function GalleryDetailActions({ detail }: GalleryDetailActionsProps) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const loadDraft = useWizardStore((state) => state.loadDraft);
  const [visibility, setVisibility] = useState(detail.visibility ?? "public");
  const [remixing, setRemixing] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);

  async function handleRemix() {
    setRemixing(true);
    try {
      if (session?.user) {
        const character = await remixCharacter(detail.id);
        const spec = parseCharacterSpec(character.spec);
        loadDraft(spec, normalizeThemeId(character.themeId) ?? null);
        toast.success("Remix saved to your library");
      } else {
        const spec = parseCharacterSpec(detail.spec);
        loadDraft(spec, normalizeThemeId(detail.themeId) ?? null);
        toast.message("Draft loaded locally — sign in to save to your library");
      }
      router.push("/create");
    } catch {
      toast.error("Could not start remix");
    } finally {
      setRemixing(false);
    }
  }

  async function handleVisibilityChange(next: "public" | "private") {
    setSavingVisibility(true);
    try {
      await patchCharacter(detail.id, { visibility: next });
      setVisibility(next);
      toast.success(
        next === "public" ? "Now public in gallery" : "Now private"
      );
    } catch {
      toast.error("Could not update visibility");
    } finally {
      setSavingVisibility(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={remixing} onClick={handleRemix} type="button">
        <ShuffleIcon />
        Remix
      </Button>
      {detail.isOwner ? (
        <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <span>Public in gallery</span>
          <Switch
            checked={visibility === "public"}
            disabled={savingVisibility}
            onCheckedChange={(checked) =>
              handleVisibilityChange(checked ? "public" : "private")
            }
          />
        </label>
      ) : null}
      {detail.remixedFrom ? (
        <p className="text-muted-foreground text-sm">
          Remixed from{" "}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            href={`/gallery/${detail.remixedFrom.id}`}
          >
            {detail.remixedFrom.name}
          </Link>
        </p>
      ) : null}
      {detail.remixCount > 0 ? (
        <p className="text-muted-foreground text-sm">
          {detail.remixCount} remix{detail.remixCount === 1 ? "" : "es"}
        </p>
      ) : null}
    </div>
  );
}
