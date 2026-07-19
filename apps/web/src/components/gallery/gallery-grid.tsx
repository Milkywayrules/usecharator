"use client";

import type { GalleryListItem } from "@charator/shared";
import { getTheme, THEME_IDS } from "@charator/spec";
import { SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { GalleryCard } from "@/components/gallery/gallery-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listGallery } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface GalleryGridProps {
  activeQuery: string | null;
  activeTheme: string | null;
  degraded: boolean;
  initialHasMore: boolean;
  initialItems: GalleryListItem[];
  initialNextOffset: number;
}

export function GalleryGrid({
  activeQuery,
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

  useEffect(() => {
    setItems(initialItems);
    setHasMore(initialHasMore);
    setNextOffset(initialNextOffset);
  }, [initialHasMore, initialItems, initialNextOffset]);

  async function loadMore() {
    setLoading(true);
    try {
      const page = await listGallery({
        offset: nextOffset,
        q: activeQuery,
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
            : activeQuery
              ? "No characters match your search."
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

export function GallerySearchBar({
  activeQuery,
}: {
  activeQuery: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(activeQuery ?? "");

  useEffect(() => {
    setValue(activeQuery ?? "");
  }, [activeQuery]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = value.trim();
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      params.delete("offset");
      const next = params.toString();
      const current = searchParams.toString();
      if (next !== current) {
        router.push(next ? `/gallery?${next}` : "/gallery");
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [router, searchParams, value]);

  return (
    <div className="relative max-w-md">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label="Search gallery by character name"
        className="pl-9"
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by name…"
        type="search"
        value={value}
      />
    </div>
  );
}

export function GalleryThemeFilter({
  activeQuery,
  activeTheme,
}: {
  activeQuery: string | null;
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
    if (activeQuery) {
      params.set("q", activeQuery);
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
