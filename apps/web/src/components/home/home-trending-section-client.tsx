"use client";

import { useEffect, useState } from "react";
import { HomeTrendingStrip } from "@/components/home/home-trending-section";
import { listGallery } from "@/lib/api-client";

export function HomeTrendingSectionClient() {
  const [degraded, setDegraded] = useState(false);
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof listGallery>>["items"]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    listGallery({ limit: 8, sort: "most_remixed" })
      .then((page) => {
        if (!cancelled) {
          setItems(page.items);
          setDegraded(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setDegraded(true);
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
  }, []);

  if (loading) {
    return (
      <section
        aria-busy="true"
        aria-labelledby="home-trending-heading"
        className="mx-auto max-w-7xl space-y-6 px-4 pb-16 sm:px-6"
      >
        <h2
          className="font-display font-semibold text-2xl tracking-tight"
          id="home-trending-heading"
        >
          Trending in gallery
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(["a", "b", "c", "d"] as const).map((slot) => (
            <div
              className="aspect-[4/5] animate-pulse rounded-xl bg-muted/40"
              key={slot}
            />
          ))}
        </div>
      </section>
    );
  }

  return <HomeTrendingStrip degraded={degraded} items={items} />;
}
