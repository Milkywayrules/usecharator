import type { GalleryListItem } from "@charator/shared";
import { getTheme } from "@charator/spec";
import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { normalizeThemeId } from "@/lib/theme-id";

export function GalleryCard({ item }: { item: GalleryListItem }) {
  const themeId = normalizeThemeId(item.themeId);
  const themeLabel = themeId ? getTheme(themeId).label : "No theme";

  return (
    <Link className="group block h-full" href={`/gallery/${item.id}`}>
      <Card className="h-full overflow-hidden py-0 transition-colors hover:border-accent/40">
        <div className="relative aspect-[4/5] overflow-hidden bg-muted/40">
          {item.coverImageUrl ? (
            // biome-ignore lint/performance/noImgElement: presigned R2 URLs are external and dynamic
            <img
              alt=""
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              src={item.coverImageUrl}
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageIcon className="size-10 opacity-40" />
              <span className="text-xs">No render yet</span>
            </div>
          )}
        </div>
        <CardHeader className="gap-2 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{themeLabel}</Badge>
          </div>
          <CardTitle className="line-clamp-2 text-lg">
            {item.name || "Untitled"}
          </CardTitle>
          <CardDescription>
            by {item.owner.displayName} ·{" "}
            {new Date(item.updatedAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-5" />
      </Card>
    </Link>
  );
}
