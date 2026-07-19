import { getTheme } from "@charator/spec";
import { ImageResponse } from "next/og";
import { fetchGalleryDetail } from "@/lib/server-api";
import { normalizeThemeId } from "@/lib/theme-id";

export const runtime = "edge";

export const alt = "Chara Tor gallery character";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

interface ImageProps {
  params: Promise<{ id: string }>;
}

export default async function OpenGraphImage({ params }: ImageProps) {
  const { id } = await params;
  const result = await fetchGalleryDetail(id);

  const name = !result.degraded && result.id ? result.name : "Character";
  const themeId =
    !result.degraded && result.id ? normalizeThemeId(result.themeId) : null;
  const themeLabel = themeId ? getTheme(themeId).label : "Gallery";

  return new ImageResponse(
    <div
      style={{
        alignItems: "flex-start",
        background:
          "linear-gradient(145deg, #121018 0%, #1a1524 55%, #0f0d12 100%)",
        color: "#f5f0e8",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "64px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div
          style={{
            color: "#d4a853",
            fontSize: 28,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Chara Tor
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            maxWidth: 900,
          }}
        >
          {name}
        </div>
        <div style={{ color: "#b8b0a6", fontSize: 32 }}>{themeLabel}</div>
      </div>
      <div style={{ color: "#8a8278", fontSize: 24 }}>
        Public gallery · charator
      </div>
    </div>,
    { ...size }
  );
}
