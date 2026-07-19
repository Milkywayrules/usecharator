"use client";

import type { CharacterResponse } from "@charator/shared";
import { getTheme, parseCharacterSpec, type ThemeId } from "@charator/spec";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, PencilIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  createCharacter,
  deleteCharacter,
  listCharacters,
  patchCharacter,
} from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import {
  deleteLocalCharacter,
  type LocalCharacterRecord,
  listLocalCharacters,
  saveLocalCharacter,
} from "@/lib/local-characters";
import { normalizeThemeId, themeIdForRequest } from "@/lib/theme-id";
import { useWizardStore } from "@/stores/wizard-store";

function CharacterCard({
  character,
  onDelete,
  onDuplicate,
  onEdit,
  onGenerate,
  onToggleVisibility,
  signedIn,
}: {
  character: {
    id: string;
    name: string;
    themeId: ThemeId | null;
    updatedAt: string;
    visibility?: "public" | "private";
    role?: string;
    gender?: string;
  };
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onGenerate: () => void;
  onToggleVisibility?: (next: "public" | "private") => void;
  signedIn: boolean;
}) {
  const themeLabel = character.themeId
    ? getTheme(character.themeId).label
    : "No theme";

  return (
    <Card className="py-0">
      <CardHeader className="gap-2 pb-3">
        <CardTitle className="text-lg">
          {character.name || "Untitled"}
        </CardTitle>
        <CardDescription>
          {themeLabel} · updated{" "}
          {new Date(character.updatedAt).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-5">
        <div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
          {character.gender ? <span>{character.gender}</span> : null}
          {character.role ? <span>· {character.role}</span> : null}
        </div>
        {signedIn && onToggleVisibility ? (
          <div className="space-y-2">
            <label className="flex items-center justify-between text-sm">
              <span>Public in gallery</span>
              <Switch
                checked={character.visibility === "public"}
                onCheckedChange={(checked) =>
                  onToggleVisibility(checked ? "public" : "private")
                }
              />
            </label>
            {character.visibility === "public" ? (
              <Link
                className="text-accent text-xs underline-offset-4 hover:underline"
                href={`/gallery/${character.id}`}
              >
                View in gallery
              </Link>
            ) : (
              <p className="text-muted-foreground text-xs">
                Private — not in gallery
              </p>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onEdit}
            size="default"
            type="button"
            variant="outline"
          >
            <PencilIcon />
            Edit
          </Button>
          <Button
            onClick={onDuplicate}
            size="default"
            type="button"
            variant="outline"
          >
            <CopyIcon />
            Duplicate
          </Button>
          <Button
            onClick={onGenerate}
            size="default"
            type="button"
            variant="outline"
          >
            <SparklesIcon />
            Generate
          </Button>
          <Button
            onClick={onDelete}
            size="default"
            type="button"
            variant="outline"
          >
            <Trash2Icon />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);
  const loadDraft = useWizardStore((state) => state.loadDraft);

  const [localChars, setLocalChars] = useState<LocalCharacterRecord[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  const serverQuery = useQuery({
    enabled: signedIn,
    queryFn: listCharacters,
    queryKey: ["characters"],
  });

  useEffect(() => {
    if (!signedIn) {
      listLocalCharacters().then(setLocalChars);
    }
  }, [signedIn]);

  useEffect(() => {
    if (signedIn) {
      listLocalCharacters().then((rows) => {
        if (rows.length > 0) {
          setImportOpen(true);
        }
      });
    }
  }, [signedIn]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const rows = await listLocalCharacters();
      for (const row of rows) {
        await createCharacter({
          name: row.name,
          spec: row.spec,
          visibility: "private",
          ...themeIdForRequest(row.themeId),
        });
        await deleteLocalCharacter(row.id);
      }
    },
    onError: () => toast.error("Import failed"),
    onSuccess: async () => {
      toast.success("Local characters imported");
      setImportOpen(false);
      setLocalChars([]);
      await queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });

  function cardFromLocal(row: LocalCharacterRecord) {
    return {
      gender: row.spec.identity.gender,
      id: row.id,
      name: row.spec.meta.name || row.name,
      role: row.spec.archetype.role,
      themeId: row.themeId,
      updatedAt: row.updatedAt,
    };
  }

  function cardFromServer(row: CharacterResponse) {
    const spec = parseCharacterSpec(row.spec);
    return {
      gender: spec.identity.gender,
      id: row.id,
      name: row.name,
      role: spec.archetype.role,
      themeId: normalizeThemeId(row.themeId) ?? null,
      updatedAt: row.updatedAt,
      visibility: row.visibility,
    };
  }

  async function handleEditLocal(id: string) {
    const row = localChars.find((item) => item.id === id);
    if (!row) {
      return;
    }
    loadDraft(row.spec, row.themeId);
    router.push("/create");
  }

  async function handleEditServer(id: string) {
    const row = serverQuery.data?.find((item) => item.id === id);
    if (!row) {
      return;
    }
    const spec = parseCharacterSpec(row.spec);
    loadDraft(spec, normalizeThemeId(row.themeId) ?? null);
    router.push("/create");
  }

  async function handleDuplicateLocal(id: string) {
    const row = localChars.find((item) => item.id === id);
    if (!row) {
      return;
    }
    const copy: LocalCharacterRecord = {
      ...row,
      id: crypto.randomUUID(),
      name: `${row.name} (copy)`,
      spec: {
        ...row.spec,
        meta: {
          ...row.spec.meta,
          id: `${row.spec.meta.id}-copy`,
          name: `${row.spec.meta.name} (copy)`,
        },
      },
      updatedAt: new Date().toISOString(),
    };
    await saveLocalCharacter(copy);
    setLocalChars(await listLocalCharacters());
  }

  const patchMutation = useMutation({
    mutationFn: async ({
      id,
      visibility,
    }: {
      id: string;
      visibility: "public" | "private";
    }) => {
      await patchCharacter(id, { visibility });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["characters"] }),
  });

  const duplicateServerMutation = useMutation({
    mutationFn: async (id: string) => {
      const row = serverQuery.data?.find((item) => item.id === id);
      if (!row) {
        throw new Error("Character not found");
      }
      await createCharacter({
        name: `${row.name} (copy)`,
        spec: row.spec,
        visibility: "private",
        ...themeIdForRequest(normalizeThemeId(row.themeId)),
      });
    },
    onError: () => toast.error("Could not duplicate"),
    onSuccess: () => {
      toast.success("Character duplicated");
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });

  const deleteServerMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteCharacter(id);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["characters"] }),
  });

  const cards = signedIn
    ? (serverQuery.data ?? []).map(cardFromServer)
    : localChars.map(cardFromLocal);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-3xl tracking-tight">
            Library
          </h1>
          <p className="mt-2 text-muted-foreground">
            {signedIn
              ? "Your saved characters on the server."
              : "Characters stored locally in this browser."}
          </p>
        </div>
        <Button asChild>
          <Link href="/create">New character</Link>
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No characters yet.</p>
          <Button asChild className="mt-4">
            <Link href="/create">Create your first</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((character) => (
            <CharacterCard
              character={character}
              key={character.id}
              onDelete={async () => {
                if (signedIn) {
                  await deleteServerMutation.mutateAsync(character.id);
                } else {
                  await deleteLocalCharacter(character.id);
                  setLocalChars(await listLocalCharacters());
                }
              }}
              onDuplicate={() =>
                signedIn
                  ? duplicateServerMutation.mutate(character.id)
                  : handleDuplicateLocal(character.id)
              }
              onEdit={() =>
                signedIn
                  ? handleEditServer(character.id)
                  : handleEditLocal(character.id)
              }
              onGenerate={() => {
                if (signedIn) {
                  handleEditServer(character.id);
                } else {
                  handleEditLocal(character.id);
                }
                router.push("/create");
              }}
              onToggleVisibility={
                signedIn
                  ? (visibility) =>
                      patchMutation.mutate({ id: character.id, visibility })
                  : undefined
              }
              signedIn={signedIn}
            />
          ))}
        </div>
      )}

      <Dialog onOpenChange={setImportOpen} open={importOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import local characters?</DialogTitle>
            <DialogDescription>
              You have characters saved in this browser. Import them to your
              account? They will be removed from local storage after import.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setImportOpen(false)}
              type="button"
              variant="outline"
            >
              Later
            </Button>
            <Button
              disabled={importMutation.isPending}
              onClick={() => importMutation.mutate()}
              type="button"
            >
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
