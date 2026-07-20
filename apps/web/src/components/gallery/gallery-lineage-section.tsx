"use client";

import type {
  GalleryLineageResponse,
  GalleryListItem,
  GallerySpecDiffResponse,
} from "@charator/shared";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GalleryCard } from "@/components/gallery/gallery-card";
import { Button } from "@/components/ui/button";
import { getGalleryLineage, getGallerySpecDiff } from "@/lib/api-client";
import { fieldLabelForPath, formatSpecDiffValue } from "@/lib/spec-diff-labels";

interface GalleryLineageSectionProps {
  characterId: string;
  initialLineage: GalleryLineageResponse | null;
  parentId: string | null;
}

const LINEAGE_CHILDREN_PAGE_SIZE = 12;

function isGalleryListItem(
  parent: GalleryLineageResponse["parent"]
): parent is GalleryListItem {
  return parent !== null && !("unavailable" in parent);
}

function ParentUnavailableStub() {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
      Original character unavailable (private or hidden)
    </div>
  );
}

function SpecDiffPanel({
  characterId,
  parentId,
}: {
  characterId: string;
  parentId: string;
}) {
  const [diff, setDiff] = useState<GallerySpecDiffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getGallerySpecDiff(characterId, parentId)
      .then((result) => {
        if (!cancelled) {
          setDiff(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
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
  }, [characterId, parentId]);

  return (
    <details className="rounded-xl border bg-muted/20">
      <summary className="cursor-pointer px-4 py-3 font-medium text-sm">
        What changed vs original
      </summary>
      <div className="space-y-4 border-t px-4 py-4">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading changes…</p>
        ) : null}
        {error ? (
          <p className="text-muted-foreground text-sm">
            Could not load spec comparison.
          </p>
        ) : null}
        {!(loading || error) && diff?.sections.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No spec field changes from the original.
          </p>
        ) : null}
        {diff?.sections.map((section) => (
          <div className="space-y-2" key={section.sectionKey}>
            <h3 className="font-medium text-sm">{section.title}</h3>
            <ul className="space-y-2 text-sm">
              {section.changes.map((change) => (
                <li
                  className="grid gap-1 rounded-lg border bg-background/60 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3"
                  key={change.path}
                >
                  <span className="text-muted-foreground">
                    {fieldLabelForPath(change.path)}
                  </span>
                  <span className="hidden text-center text-muted-foreground sm:inline">
                    →
                  </span>
                  <span>
                    <span className="text-muted-foreground line-through sm:mr-2">
                      {formatSpecDiffValue(change.from)}
                    </span>
                    <span className="sm:hidden"> → </span>
                    <span>{formatSpecDiffValue(change.to)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

export function GalleryLineageSection({
  characterId,
  initialLineage,
  parentId,
}: GalleryLineageSectionProps) {
  const [lineage, setLineage] = useState<GalleryLineageResponse | null>(
    initialLineage
  );
  const [loadingPage, setLoadingPage] = useState(false);

  useEffect(() => {
    setLineage(initialLineage);
  }, [initialLineage]);

  const loadPage = useCallback(
    async (page: number) => {
      setLoadingPage(true);
      try {
        const next = await getGalleryLineage(characterId, page);
        setLineage(next);
      } finally {
        setLoadingPage(false);
      }
    },
    [characterId]
  );

  if (!lineage) {
    return null;
  }

  const totalChildren = lineage.children.total;
  const currentPage = lineage.children.page;
  const computedTotalPages = Math.max(
    1,
    Math.ceil(totalChildren / LINEAGE_CHILDREN_PAGE_SIZE)
  );

  const showSection =
    lineage.parent !== null ||
    totalChildren > 0 ||
    lineage.ancestors.length > 0;

  if (!showSection) {
    return null;
  }

  const showParentDiff =
    parentId && lineage.parent && isGalleryListItem(lineage.parent);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-display font-semibold text-xl">Lineage</h2>
        {lineage.depthCapped ? (
          <p className="text-muted-foreground text-sm">
            Ancestor chain continues beyond the displayed depth.
          </p>
        ) : null}
      </div>

      {lineage.ancestors.length > 0 ? (
        <nav
          aria-label="Character ancestry"
          className="flex flex-wrap items-center gap-1 text-muted-foreground text-sm"
        >
          {lineage.ancestors.map((ancestor) => (
            <span className="inline-flex items-center gap-1" key={ancestor.id}>
              <Link
                className="text-foreground underline-offset-4 hover:underline"
                href={`/gallery/${ancestor.id}`}
              >
                {ancestor.name}
              </Link>
              <ChevronRightIcon aria-hidden className="size-3.5" />
            </span>
          ))}
        </nav>
      ) : null}

      {lineage.parent ? (
        <div className="space-y-2">
          <h3 className="font-medium text-sm">Original</h3>
          {isGalleryListItem(lineage.parent) ? (
            <div className="max-w-xs">
              <GalleryCard item={lineage.parent} />
            </div>
          ) : (
            <ParentUnavailableStub />
          )}
        </div>
      ) : null}

      {showParentDiff ? (
        <SpecDiffPanel characterId={characterId} parentId={parentId} />
      ) : null}

      {totalChildren > 0 ? (
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Remixes ({totalChildren})</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {lineage.children.items.map((item) => (
              <GalleryCard item={item} key={item.id} />
            ))}
          </div>
          {computedTotalPages > 1 ? (
            <div className="flex items-center justify-center gap-3">
              <Button
                disabled={loadingPage || currentPage <= 1}
                onClick={() => loadPage(currentPage - 1)}
                type="button"
                variant="outline"
              >
                Previous
              </Button>
              <span className="text-muted-foreground text-sm">
                Page {currentPage} of {computedTotalPages}
              </span>
              <Button
                disabled={loadingPage || currentPage >= computedTotalPages}
                onClick={() => loadPage(currentPage + 1)}
                type="button"
                variant="outline"
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      ) : lineage.parent ? (
        <p className="text-muted-foreground text-sm">No public remixes yet.</p>
      ) : null}
    </section>
  );
}
