import type { Metadata } from "next";
import { HomeHero } from "@/components/home/home-hero";
import { HomeTrendingSection } from "@/components/home/home-trending-section";
import { HomeTrendingSectionClient } from "@/components/home/home-trending-section-client";
import { fetchGalleryList } from "@/lib/server-api";

export const metadata: Metadata = {
  description:
    "Wizard-driven character image generator. Create from structured specs or remix from the public gallery.",
  openGraph: {
    description:
      "Wizard-driven character image generator. Create from structured specs or remix from the public gallery.",
    title: "Chara Tor",
  },
  title: "Home",
};

export default async function HomePage() {
  if (process.env.E2E === "1") {
    return (
      <>
        <HomeHero />
        <HomeTrendingSectionClient />
      </>
    );
  }

  const trending = await fetchGalleryList({
    limit: 8,
    sort: "most_remixed",
  });

  return (
    <>
      <HomeHero />
      <HomeTrendingSection data={trending} />
    </>
  );
}
