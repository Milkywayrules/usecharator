import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.35_0.08_280/0.25),transparent_55%)]"
      />
      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <p className="mb-4 font-mono text-muted-foreground text-sm uppercase tracking-widest">
          character generator
        </p>
        <h1 className="mb-6 font-semibold text-4xl tracking-tight sm:text-5xl">
          Chara Tor
        </h1>
        <p className="mb-10 text-lg text-muted-foreground leading-relaxed">
          Define characters with structured specs, pick a visual theme, and
          generate images with your own provider keys. The wizard UI arrives in
          a later release — this is the foundation.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button disabled size="lg">
            Start wizard
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="/api/health" rel="noopener noreferrer" target="_blank">
              API health
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}
