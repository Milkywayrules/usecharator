"use client";

import type {
  GalleryDetailResponse,
  GalleryLineageResponse,
} from "@charator/shared";
import { getTheme, parseCharacterSpec } from "@charator/spec";
import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GalleryDetailActions } from "@/components/gallery/gallery-detail-actions";
import { GalleryLineageSection } from "@/components/gallery/gallery-lineage-section";
import { GalleryReportButton } from "@/components/gallery/gallery-report-button";
import { CharacterSummary, SpecViewer } from "@/components/gallery/spec-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getGalleryCharacter, getGalleryLineage } from "@/lib/api-client";
import { normalizeThemeId } from "@/lib/theme-id";

export function GalleryDetailClient({ id }: { id: string }) {
  const [detail, setDetail] = useState<GalleryDetailResponse | null>(null);
  const [lineage, setLineage] = useState<GalleryLineageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    Promise.all([getGalleryCharacter(id), getGalleryLineage(id)])
      .then(([nextDetail, nextLineage]) => {
        if (!cancelled) {
          setDetail(nextDetail);
          setLineage(nextLineage);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-muted-foreground sm:px-6">
        Loading character…
      </div>
    );
  }

  if (failed || !detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="font-display font-semibold text-2xl">
          Gallery unavailable
        </h1>
        <p className="mt-3 text-muted-foreground">
          Could not load this character right now. Try again later or browse the
          gallery.
        </p>
        <Button asChild className="mt-6">
          <Link href="/gallery">Back to gallery</Link>
        </Button>
      </div>
    );
  }

  const spec = parseCharacterSpec(detail.spec);
  const themeId = normalizeThemeId(detail.themeId);
  const themeLabel = themeId ? getTheme(themeId).label : "No theme";

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      <div className="space-y-4">
        <Button asChild variant="outline">
          <Link href="/gallery">← Gallery</Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{themeLabel}</Badge>
              {detail.visibility === "private" && detail.isOwner ? (
                <Badge variant="outline">Private (owner view)</Badge>
              ) : null}
              {detail.hiddenByModeration ? (
                <Badge
                  className="border-destructive/40 text-destructive"
                  variant="outline"
                >
                  Hidden by moderation
                </Badge>
              ) : null}
            </div>
            <h1 className="font-display font-semibold text-3xl tracking-tight">
              {detail.name || "Untitled"}
            </h1>
            <p className="text-muted-foreground">
              by {detail.owner.displayName} · updated{" "}
              {new Date(detail.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <GalleryDetailActions detail={detail} />
            <GalleryReportButton
              characterId={detail.id}
              isOwner={detail.isOwner}
            />
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="font-display font-semibold text-xl">Renders</h2>
        {detail.renders.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {detail.renders.map((url) => (
              <a
                className="group overflow-hidden rounded-xl border bg-muted/30"
                href={url}
                key={url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {/* biome-ignore lint/performance/noImgElement: presigned R2 URLs are external and dynamic */}
                <img
                  alt=""
                  className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  src={url}
                />
              </a>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-muted-foreground">
            <ImageIcon className="size-10 opacity-40" />
            <p className="text-sm">No renders yet</p>
          </div>
        )}
      </section>

      <GalleryLineageSection
        characterId={detail.id}
        initialLineage={lineage}
        parentId={detail.remixedFrom?.id ?? null}
      />

      <section className="space-y-4">
        <h2 className="font-display font-semibold text-xl">Summary</h2>
        <CharacterSummary spec={spec} themeLabel={themeLabel} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display font-semibold text-xl">Full spec</h2>
        <SpecViewer spec={spec} />
      </section>
    </div>
  );
}
