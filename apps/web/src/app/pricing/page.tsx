"use client";

import {
  type LIMIT_KEYS,
  TIER_DISPLAY_NAMES,
  TIER_IDS,
  TIER_LIMITS,
  TIER_PRICES_USD_MONTHLY,
} from "@charator/shared";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FEATURE_ROWS: { key: (typeof LIMIT_KEYS)[number]; label: string }[] = [
  { key: "workspaces", label: "Workspaces" },
  { key: "charactersPerWorkspace", label: "Characters / workspace" },
  { key: "sheetBatchesPerMonth", label: "Sheet batches / month" },
  { key: "storedGenerationsPerWorkspace", label: "Stored generations" },
  { key: "anchorImagesPerWorkspace", label: "Anchor images" },
  { key: "apiTokensPerWorkspace", label: "API tokens / workspace" },
  {
    key: "authenticatedGenerationsPerHour",
    label: "Generations / hour (signed in)",
  },
];

function formatLimit(value: number | null): string {
  return value === null ? "Unlimited" : String(value);
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
      <div className="space-y-3 text-center">
        <h1 className="font-display font-semibold text-4xl tracking-tight">
          Pricing
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Platform tiers gate workspace capacity and history — generation costs
          are paid to your provider directly on every tier (BYOK).
        </p>
        <p className="text-muted-foreground text-sm">
          Checkout is coming soon. Tiers are manually assignable during early
          access.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {TIER_IDS.map((tier) => (
          <Card className="flex flex-col" key={tier}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{TIER_DISPLAY_NAMES[tier]}</CardTitle>
                {tier === "free" ? (
                  <Badge variant="secondary">Base</Badge>
                ) : null}
              </div>
              <CardDescription>
                <span className="font-semibold text-2xl text-foreground">
                  ${TIER_PRICES_USD_MONTHLY[tier]}
                </span>
                <span className="text-muted-foreground"> / month</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-2 text-sm">
              {FEATURE_ROWS.map((row) => (
                <div className="flex justify-between gap-4" key={row.key}>
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">
                    {formatLimit(TIER_LIMITS[tier][row.key])}
                  </span>
                </div>
              ))}
            </CardContent>
            <CardContent className="pt-0">
              <Button
                className="w-full"
                disabled
                type="button"
                variant="outline"
              >
                Coming soon
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feature matrix</CardTitle>
          <CardDescription>
            Privacy (private / unlisted characters) is available on Free — never
            paywalled.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 font-medium">Limit</th>
                {TIER_IDS.map((tier) => (
                  <th className="px-3 py-2 font-medium" key={tier}>
                    {TIER_DISPLAY_NAMES[tier]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr className="border-b" key={row.key}>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {row.label}
                  </td>
                  {TIER_IDS.map((tier) => (
                    <td className="px-3 py-2" key={tier}>
                      {formatLimit(TIER_LIMITS[tier][row.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
        <CardContent className="border-t pt-0 text-muted-foreground text-sm">
          Need a higher tier?{" "}
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href="/settings#plan"
          >
            View plan &amp; usage
          </Link>{" "}
          when signed in.
        </CardContent>
      </Card>
    </div>
  );
}
