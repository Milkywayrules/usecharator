"use client";

import type { GallerySort } from "@charator/shared";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORT_OPTIONS: { label: string; value: GallerySort }[] = [
  { label: "Most recent", value: "recent" },
  { label: "Most remixed", value: "most_remixed" },
];

export function GallerySortFilter({ activeSort }: { activeSort: GallerySort }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setSort(sort: GallerySort) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === "recent") {
      params.delete("sort");
    } else {
      params.set("sort", sort);
    }
    params.delete("offset");
    const query = params.toString();
    router.push(query ? `/gallery?${query}` : "/gallery");
  }

  return (
    <Select
      onValueChange={(value) => setSort(value as GallerySort)}
      value={activeSort}
    >
      <SelectTrigger aria-label="Sort gallery" className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
