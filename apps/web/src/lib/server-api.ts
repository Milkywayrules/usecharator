import {
  type GalleryDetailResponse,
  type GalleryLineageResponse,
  type GalleryListResponse,
  type GallerySort,
  galleryDetailResponseSchema,
  galleryLineageResponseSchema,
  galleryListResponseSchema,
} from "@charator/shared";

const EMPTY_LIST: GalleryListResponse = {
  hasMore: false,
  items: [],
  nextOffset: 0,
};

export function resolveServerApiBaseUrl(): string {
  return (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3001"
  );
}

function galleryListUrl(params?: {
  limit?: number;
  offset?: number;
  q?: string | null;
  sort?: GallerySort | null;
  theme?: string | null;
}): string {
  const url = new URL("/api/gallery", resolveServerApiBaseUrl());
  if (params?.offset !== undefined) {
    url.searchParams.set("offset", String(params.offset));
  }
  if (params?.limit !== undefined) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params?.theme) {
    url.searchParams.set("theme", params.theme);
  }
  if (params?.q) {
    url.searchParams.set("q", params.q);
  }
  if (params?.sort && params.sort !== "recent") {
    url.searchParams.set("sort", params.sort);
  }
  return url.toString();
}

export type GalleryListFetchResult = GalleryListResponse & {
  degraded: boolean;
};

export type GalleryDetailFetchResult =
  | (GalleryDetailResponse & { degraded: false })
  | { degraded: true; detail: null; notFound?: boolean };

export async function fetchGalleryList(params?: {
  limit?: number;
  offset?: number;
  q?: string | null;
  sort?: GallerySort | null;
  theme?: string | null;
}): Promise<GalleryListFetchResult> {
  try {
    const response = await fetch(galleryListUrl(params), {
      next: { revalidate: 30 },
    });
    if (!response.ok) {
      return { ...EMPTY_LIST, degraded: true };
    }
    const parsed = galleryListResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return { ...EMPTY_LIST, degraded: true };
    }
    return { ...parsed.data, degraded: false };
  } catch {
    return { ...EMPTY_LIST, degraded: true };
  }
}

export async function fetchGalleryDetail(
  id: string
): Promise<GalleryDetailFetchResult> {
  try {
    const response = await fetch(
      `${resolveServerApiBaseUrl()}/api/gallery/${id}`,
      { next: { revalidate: 30 } }
    );
    if (response.status === 404) {
      return { degraded: true, detail: null, notFound: true };
    }
    if (!response.ok) {
      return { degraded: true, detail: null };
    }
    const parsed = galleryDetailResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return { degraded: true, detail: null };
    }
    return { ...parsed.data, degraded: false };
  } catch {
    return { degraded: true, detail: null };
  }
}

export type GalleryLineageFetchResult =
  | (GalleryLineageResponse & { degraded: false })
  | { degraded: true; lineage: null };

export async function fetchGalleryLineage(
  id: string,
  page = 1
): Promise<GalleryLineageFetchResult> {
  try {
    const url = new URL(
      `/api/gallery/${id}/lineage`,
      resolveServerApiBaseUrl()
    );
    url.searchParams.set("page", String(page));
    const response = await fetch(url.toString(), {
      next: { revalidate: 30 },
    });
    if (!response.ok) {
      return { degraded: true, lineage: null };
    }
    const parsed = galleryLineageResponseSchema.safeParse(
      await response.json()
    );
    if (!parsed.success) {
      return { degraded: true, lineage: null };
    }
    return { ...parsed.data, degraded: false };
  } catch {
    return { degraded: true, lineage: null };
  }
}
