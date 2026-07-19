"use client";

import type { CharacterGenerationHistoryItem } from "@charator/shared";
import { isTerminalJobStatus } from "@charator/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2Icon,
  RotateCcwIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listCharacterGenerations,
  listCharacters,
  rerollGeneration,
} from "@/lib/api-client";
import { getLocalKey } from "@/lib/local-keys";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function HistoryEntry({ entry }: { entry: CharacterGenerationHistoryItem }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const rerollMutation = useMutation({
    mutationFn: async () => {
      const apiKey = getLocalKey(entry.provider);
      return rerollGeneration(entry.id, apiKey ? { apiKey } : {});
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSuccess: (data) => {
      toast.success("Re-roll started");
      router.push(`/generate/${data.jobId}`);
    },
  });

  const canReroll = isTerminalJobStatus(entry.status);

  return (
    <li className="rounded-xl border bg-card/40 p-4">
      <div className="flex flex-wrap gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-lg border bg-muted/30">
          {entry.imageUrl ? (
            // biome-ignore lint/performance/noImgElement: presigned URL
            <img
              alt=""
              className="size-full object-cover"
              height={80}
              src={entry.imageUrl}
              width={80}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground text-xs">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{entry.status}</Badge>
            <span className="text-muted-foreground text-sm">
              {entry.provider} · {entry.model}
            </span>
            <span className="text-muted-foreground text-sm">
              {relativeTime(entry.createdAt)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="default" type="button" variant="outline">
              <Link href={`/generate/${entry.id}`}>
                <ExternalLinkIcon />
                View job
              </Link>
            </Button>
            {canReroll ? (
              <Button
                disabled={rerollMutation.isPending}
                onClick={() => rerollMutation.mutate()}
                size="default"
                type="button"
                variant="outline"
              >
                {rerollMutation.isPending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <RotateCcwIcon />
                )}
                Re-roll
              </Button>
            ) : null}
            <Button
              onClick={() => setExpanded((value) => !value)}
              size="default"
              type="button"
              variant="outline"
            >
              {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
              Prompt
            </Button>
          </div>
          {expanded ? (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs">
                {entry.prompt}
              </pre>
              <Button
                onClick={async () => {
                  await navigator.clipboard.writeText(entry.prompt);
                  toast.success("Prompt copied");
                }}
                size="default"
                type="button"
                variant="outline"
              >
                <CopyIcon />
                Copy prompt
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function CharacterHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const characterQuery = useQuery({
    queryFn: listCharacters,
    queryKey: ["characters"],
  });

  const historyQuery = useQuery({
    queryFn: () => listCharacterGenerations(id),
    queryKey: ["character-generations", id],
  });

  const character = characterQuery.data?.find((row) => row.id === id);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <Button asChild variant="outline">
          <Link href="/library">← Library</Link>
        </Button>
        <h1 className="font-display font-semibold text-3xl tracking-tight">
          Generation history
        </h1>
        <p className="text-muted-foreground">
          {character?.name ?? "Character"} — prompts and renders over time
        </p>
      </div>

      {historyQuery.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="animate-spin" />
          Loading…
        </div>
      ) : null}

      {historyQuery.data?.items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          No generations linked to this character yet.
        </div>
      ) : (
        <ul className="space-y-4">
          {historyQuery.data?.items.map((entry) => (
            <HistoryEntry entry={entry} key={entry.id} />
          ))}
        </ul>
      )}
    </div>
  );
}
