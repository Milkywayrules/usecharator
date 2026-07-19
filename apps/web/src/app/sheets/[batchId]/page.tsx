"use client";

import type { SheetBatchResponse } from "@charator/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DownloadIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSheetBatch, rerollGeneration } from "@/lib/api-client";

const TERMINAL = new Set(["succeeded", "failed"]);

function statusBadgeVariant(
  status: string
): "default" | "outline" | "secondary" {
  if (status === "succeeded" || status === "completed") {
    return "default";
  }
  if (status === "failed") {
    return "outline";
  }
  if (status === "running") {
    return "secondary";
  }
  return "outline";
}

function batchBanner(batch: SheetBatchResponse): string {
  if (batch.status === "running") {
    return "Sheet batch in progress…";
  }
  if (batch.status === "completed") {
    return "All variants completed.";
  }
  if (batch.status === "partial") {
    return "Sheet finished with some failures.";
  }
  return "Sheet batch failed.";
}

export default function SheetBatchPage() {
  const { batchId } = useParams<{ batchId: string }>();

  const batchQuery = useQuery({
    enabled: Boolean(batchId),
    queryFn: () => getSheetBatch(batchId),
    queryKey: ["sheet-batch", batchId],
    refetchInterval: (query) => {
      const { data } = query.state;
      if (!data || data.status === "running") {
        return 3000;
      }
      return false;
    },
  });

  const rerollMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await rerollGeneration(jobId, {});
      await batchQuery.refetch();
    },
  });

  const batch = batchQuery.data;

  async function downloadImage(url: string, filename: string) {
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  if (batchQuery.isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-destructive">
        Could not load sheet batch.
      </div>
    );
  }

  if (batchQuery.isLoading || !batch) {
    return (
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-16 text-muted-foreground">
        <Loader2Icon className="animate-spin" />
        Loading sheet batch…
      </div>
    );
  }

  const succeededVariants = batch.variants.filter(
    (variant) => variant.status === "succeeded" && variant.imageUrls?.[0]
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          <Link className="underline-offset-4 hover:underline" href="/library">
            Library
          </Link>
        </p>
        <h1 className="font-display font-semibold text-3xl tracking-tight">
          Character sheet
        </h1>
        <p className="text-muted-foreground">
          Preset {batch.preset} · {batch.estimatedCalls} provider calls
        </p>
      </div>

      <div
        className="rounded-xl border bg-card/60 p-4"
        data-testid="sheet-batch-banner"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={statusBadgeVariant(batch.status)}>
            {batch.status}
          </Badge>
          <p className="text-sm">{batchBanner(batch)}</p>
        </div>
      </div>

      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="sheet-variant-grid"
      >
        {batch.variants.map((variant) => (
          <Card className="py-0" key={variant.jobId}>
            <CardHeader className="gap-1 pb-2">
              <CardTitle className="text-base">{variant.label}</CardTitle>
              <CardDescription>{variant.variantId}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-5">
              <Badge variant={statusBadgeVariant(variant.status)}>
                {variant.status}
              </Badge>
              {variant.imageUrls?.[0] ? (
                <figure className="overflow-hidden rounded-md border">
                  {/* biome-ignore lint/performance/noImgElement: presigned job url */}
                  <img
                    alt={variant.label}
                    className="aspect-square w-full object-cover"
                    src={variant.imageUrls[0]}
                  />
                </figure>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-md border border-dashed text-muted-foreground text-sm">
                  {variant.status === "failed"
                    ? (variant.error ?? "Failed")
                    : "Waiting…"}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {variant.imageUrls?.[0] ? (
                  <Button
                    onClick={() =>
                      downloadImage(
                        variant.imageUrls?.[0] ?? "",
                        `${variant.variantId}.png`
                      )
                    }
                    size="default"
                    type="button"
                    variant="outline"
                  >
                    <DownloadIcon />
                    Download
                  </Button>
                ) : null}
                {TERMINAL.has(variant.status) ? (
                  <Button
                    disabled={rerollMutation.isPending}
                    onClick={() => rerollMutation.mutate(variant.jobId)}
                    size="default"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCwIcon />
                    Re-roll
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {succeededVariants.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {succeededVariants.map((variant) => (
            <Button
              key={variant.jobId}
              onClick={() =>
                downloadImage(
                  variant.imageUrls?.[0] ?? "",
                  `${variant.variantId}.png`
                )
              }
              type="button"
              variant="outline"
            >
              <DownloadIcon />
              {variant.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
