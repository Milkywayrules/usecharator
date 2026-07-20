import { type GallerySort, normalizeGalleryQuery } from "@charator/shared";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  GalleryGrid,
  GallerySearchBar,
  GalleryThemeFilter,
} from "@/components/gallery/gallery-grid";
import { GallerySortFilter } from "@/components/gallery/gallery-sort-filter";
import { fetchGalleryList } from "@/lib/server-api";

export const metadata: Metadata = {
  description: "Browse public characters shared by the Chara Tor community.",
  openGraph: {
    description: "Browse public characters shared by the Chara Tor community.",
    title: "Gallery · Chara Tor",
  },
  title: "Gallery",
};

interface GalleryPageProps {
  searchParams: Promise<{ q?: string; sort?: string; theme?: string }>;
}

function parseGallerySort(raw: string | undefined): GallerySort {
  return raw === "most_remixed" ? "most_remixed" : "recent";
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const params = await searchParams;
  const activeTheme = params.theme?.trim() ? params.theme.trim() : null;
  const activeQuery = normalizeGalleryQuery(params.q);
  const activeSort = parseGallerySort(params.sort);
  const data = await fetchGalleryList({
    q: activeQuery,
    sort: activeSort,
    theme: activeTheme,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      <div className="space-y-3">
        <p className="font-mono text-muted-foreground text-sm uppercase tracking-widest">
          community
        </p>
        <h1 className="font-display font-semibold text-3xl tracking-tight">
          Gallery
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Public characters from other creators. Remix any entry into your own
          draft or browse by visual theme.
        </p>
      </div>

      <div className="space-y-4">
        <Suspense fallback={<div className="h-9 max-w-md" />}>
          <GallerySearchBar activeQuery={activeQuery} />
        </Suspense>
        <Suspense fallback={<div className="h-9" />}>
          <GalleryThemeFilter
            activeQuery={activeQuery}
            activeTheme={activeTheme}
          />
        </Suspense>
        <Suspense fallback={<div className="h-9 w-[180px]" />}>
          <GallerySortFilter activeSort={activeSort} />
        </Suspense>
      </div>

      {data.degraded ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100/90 text-sm">
          Gallery data is temporarily unavailable. You can still browse themes
          and try again shortly.
        </div>
      ) : null}

      <GalleryGrid
        activeQuery={activeQuery}
        activeSort={activeSort}
        activeTheme={activeTheme}
        degraded={data.degraded}
        initialHasMore={data.hasMore}
        initialItems={data.items}
        initialNextOffset={data.nextOffset}
      />
    </div>
  );
}
