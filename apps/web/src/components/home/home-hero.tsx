"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function HomeHero() {
  const { data: session, isPending } = authClient.useSession();
  const signedIn = !isPending && Boolean(session?.user);

  return (
    <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.35_0.08_280/0.25),transparent_55%)]"
      />
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <p className="mb-4 font-mono text-muted-foreground text-sm uppercase tracking-widest">
          character generator
        </p>
        <h1 className="mb-6 font-display font-semibold text-4xl tracking-tight sm:text-5xl">
          Chara Tor
        </h1>
        <p className="mb-10 text-lg text-muted-foreground leading-relaxed">
          {signedIn ? (
            <>
              Pick up where you left off — or explore what others are remixing.{" "}
              <Link
                className="font-medium text-accent underline-offset-4 hover:underline"
                href="/library"
              >
                Continue in Library
              </Link>
            </>
          ) : (
            <>
              Define characters with structured specs, pick a visual theme, and
              generate images with your own provider keys. Remix public
              characters from the community gallery.
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/create">Start creating</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/gallery">Browse gallery</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
