import type { GalleryListItem } from "@charator/shared";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { GalleryCard } from "@/components/gallery/gallery-card";
import type { GalleryListFetchResult } from "@/lib/server-api";

interface HomeTrendingSectionProps {
  data: GalleryListFetchResult;
}

export function HomeTrendingSection({ data }: HomeTrendingSectionProps) {
  return <HomeTrendingStrip degraded={data.degraded} items={data.items} />;
}

export function HomeTrendingStrip({
  degraded,
  items,
}: {
  degraded: boolean;
  items: GalleryListItem[];
}) {
  return (
    <section
      aria-labelledby="home-trending-heading"
      className="mx-auto max-w-7xl space-y-6 px-4 pb-16 sm:px-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-muted-foreground text-sm uppercase tracking-widest">
            community
          </p>
          <h2
            className="font-display font-semibold text-2xl tracking-tight sm:text-3xl"
            id="home-trending-heading"
          >
            Trending in gallery
          </h2>
          <p className="max-w-2xl text-muted-foreground text-sm sm:text-base">
            Public characters getting the most remixes right now.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-1 font-medium text-accent text-sm hover:underline"
          href="/gallery?sort=most_remixed"
        >
          See all trending
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>

      {degraded ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100/90 text-sm">
          Trending gallery picks are temporarily unavailable. You can still
          browse the full gallery or start a new character.
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <GalleryCard item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-muted-foreground">
            {degraded
              ? "Trending characters will appear here once gallery data is back."
              : "No public remixes yet — be the first to share in the gallery."}
          </p>
        </div>
      )}
    </section>
  );
}
