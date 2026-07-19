"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton } from "@/components/auth/sign-in-button";
import { UserMenu } from "@/components/auth/user-menu";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/create", label: "Create" },
  { href: "/library", label: "Library" },
  { href: "/settings", label: "Settings" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link className="group flex items-center gap-2" href="/">
            <span className="flex size-8 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 font-bold font-display text-accent text-sm">
              CT
            </span>
            <span className="font-display font-semibold text-lg tracking-tight">
              Chara Tor
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <Link
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-secondary",
                  pathname.startsWith(item.href)
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground"
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {isPending ? (
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
          ) : null}
          {!isPending && session?.user ? (
            <UserMenu user={session.user} />
          ) : null}
          {isPending || session?.user ? null : <SignInButton />}
        </div>
      </div>
    </header>
  );
}
