"use client";

import {
  type EntitlementsResponse,
  type LimitKey,
  TIER_DISPLAY_NAMES,
  type TierId,
  type TierLimitValue,
} from "@charator/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  createBillingCheckout,
  createBillingPortal,
  getBillingSubscription,
  getEntitlements,
} from "@/lib/api-client";

const USAGE_ROWS: {
  label: string;
  limitKey?: LimitKey;
  usageKey: keyof EntitlementsResponse["usage"];
}[] = [
  { label: "Workspaces", limitKey: "workspaces", usageKey: "workspaces" },
  {
    label: "Characters (this workspace)",
    limitKey: "charactersPerWorkspace",
    usageKey: "characters",
  },
  {
    label: "Sheet batches this month",
    limitKey: "sheetBatchesPerMonth",
    usageKey: "sheetBatchesThisMonth",
  },
  {
    label: "Generations this month",
    usageKey: "generationsThisMonth",
  },
  {
    label: "Stored generations",
    limitKey: "storedGenerationsPerWorkspace",
    usageKey: "storedGenerations",
  },
  {
    label: "Anchor images",
    limitKey: "anchorImagesPerWorkspace",
    usageKey: "anchorImages",
  },
  {
    label: "API tokens (this workspace)",
    limitKey: "apiTokensPerWorkspace",
    usageKey: "apiTokens",
  },
];

function usagePercent(current: number, limit: TierLimitValue): number | null {
  if (limit === null || limit === 0) {
    return null;
  }
  return Math.min(100, Math.round((current / limit) * 100));
}

export function PlanUsageSettingsSection() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const entitlementsQuery = useQuery({
    queryFn: getEntitlements,
    queryKey: ["entitlements"],
  });

  const subscriptionQuery = useQuery({
    queryFn: getBillingSubscription,
    queryKey: ["billing-subscription"],
  });

  const checkoutMutation = useMutation({
    mutationFn: createBillingCheckout,
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });

  const portalMutation = useMutation({
    mutationFn: createBillingPortal,
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });

  useEffect(() => {
    if (searchParams.get("billing") === "success") {
      toast.success("Plan updated");
      queryClient.invalidateQueries({ queryKey: ["entitlements"] });
      queryClient.invalidateQueries({ queryKey: ["billing-subscription"] });
    }
  }, [queryClient, searchParams]);

  const { data } = entitlementsQuery;
  const tier = data?.tier ?? "free";
  const subscription = subscriptionQuery.data?.subscription;

  return (
    <Card id="plan">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Plan &amp; usage</CardTitle>
          <Badge variant="secondary">
            {TIER_DISPLAY_NAMES[tier as TierId]}
          </Badge>
          {subscription ? (
            <Badge variant="outline">{subscription.status}</Badge>
          ) : null}
        </div>
        <CardDescription>
          Workspace limits follow the workspace owner&apos;s tier. Generation
          costs stay on your provider (BYOK) — tiers only expand platform
          capacity.
          {subscription?.cancelAtPeriodEnd
            ? " Cancellation scheduled (mock applies immediately)."
            : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {entitlementsQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading usage…</p>
        ) : null}
        {entitlementsQuery.isError ? (
          <p className="text-destructive text-sm">
            {entitlementsQuery.error instanceof Error
              ? entitlementsQuery.error.message
              : "Could not load plan usage"}
          </p>
        ) : null}
        {data ? (
          <ul className="space-y-4">
            {USAGE_ROWS.map((row) => {
              const current = data.usage[row.usageKey];
              const limit = row.limitKey
                ? data.limits[row.limitKey]
                : undefined;
              const percent =
                row.limitKey && limit !== undefined
                  ? usagePercent(current, limit)
                  : null;
              return (
                <li className="space-y-2" key={row.usageKey}>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span>{row.label}</span>
                    <span className="text-muted-foreground">
                      {row.limitKey === undefined
                        ? current
                        : `${current}${
                            limit === null ? " / Unlimited" : ` / ${limit}`
                          }`}
                    </span>
                  </div>
                  {percent === null ? (
                    <Progress className="h-2" value={0} />
                  ) : (
                    <Progress className="h-2" value={percent} />
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button asChild type="button" variant="outline">
            <Link href="/pricing">View pricing</Link>
          </Button>
          {subscription && subscription.status === "active" ? (
            <Button
              disabled={portalMutation.isPending}
              onClick={() => portalMutation.mutate()}
              type="button"
            >
              Manage subscription
            </Button>
          ) : (
            <Button
              disabled={checkoutMutation.isPending || tier === "studio"}
              onClick={() => checkoutMutation.mutate({ tier: "plus" })}
              type="button"
            >
              Upgrade to Plus
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
