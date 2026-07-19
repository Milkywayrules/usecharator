import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";
import { UmamiAnalytics } from "@/components/umami-analytics";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  applicationName: "Chara Tor",
  description:
    "Wizard-driven character image generator. Bring your own API keys.",
  title: {
    default: "Chara Tor",
    template: "%s · Chara Tor",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${syne.variable} ${dmSans.variable} relative min-h-dvh font-sans antialiased`}
      >
        <div className="root isolate">
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </div>
        <UmamiAnalytics />
      </body>
    </html>
  );
}
