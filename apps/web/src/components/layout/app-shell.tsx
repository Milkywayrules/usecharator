import { SiteHeader } from "@/components/layout/site-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain relative flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
