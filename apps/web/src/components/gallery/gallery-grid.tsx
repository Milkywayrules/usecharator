"use client";

import type { GalleryListItem } from "@charator/shared";
import { getTheme, THEME_IDS } from "@charator/spec";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { GalleryCard } from "@/components/gallery/gallery-card";
import { Button } from "@/components/ui/button";
import { listGallery } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface GalleryGridProps {
  activeTheme: string | null;
  degraded: boolean;
  initialHasMore: boolean;
  initialItems: GalleryListItem[];
  initialNextOffset: number;
}

export function GalleryGrid({
  activeTheme,
  degraded,
  initialHasMore,
  initialItems,
  initialNextOffset,
}: GalleryGridProps) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    try {
      const page = await listGallery({
        offset: nextOffset,
        theme: activeTheme,
      });
      setItems((current) => [...current, ...page.items]);
      setHasMore(page.hasMore);
      setNextOffset(page.nextOffset);
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          {degraded
            ? "Gallery is unavailable right now. Try again later."
            : activeTheme
              ? "No public characters for this theme yet."
              : "No public characters yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <GalleryCard item={item} key={item.id} />
        ))}
      </div>
      {hasMore ? (
        <div className="flex justify-center">
          <Button
            disabled={loading || degraded}
            onClick={loadMore}
            type="button"
            variant="outline"
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function GalleryThemeFilter({
  activeTheme,
}: {
  activeTheme: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setTheme(theme: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (theme) {
      params.set("theme", theme);
    } else {
      params.delete("theme");
    }
    params.delete("offset");
    const query = params.toString();
    router.push(query ? `/gallery?${query}` : "/gallery");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className={cn(
          "rounded-full border px-3 py-1 text-sm transition-colors",
          activeTheme
            ? "text-muted-foreground hover:bg-secondary"
            : "border-accent/40 bg-accent/15 text-foreground"
        )}
        onClick={() => setTheme(null)}
        type="button"
      >
        All
      </button>
      {THEME_IDS.map((themeId) => (
        <button
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            activeTheme === themeId
              ? "border-accent/40 bg-accent/15 text-foreground"
              : "text-muted-foreground hover:bg-secondary"
          )}
          key={themeId}
          onClick={() => setTheme(themeId)}
          type="button"
        >
          {getTheme(themeId).label}
        </button>
      ))}
    </div>
  );
}
