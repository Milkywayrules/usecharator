import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { UmamiAnalytics } from "@/components/umami-analytics";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  applicationName: "Chara Tor",
  description:
    "Wizard-driven character image generator. Bring your own API keys.",
  title: "Chara Tor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="dark" lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh font-sans`}
      >
        {children}
        <UmamiAnalytics />
      </body>
    </html>
  );
}
