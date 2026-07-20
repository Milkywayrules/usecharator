"use client";

import { TIER_DISPLAY_NAMES } from "@charator/shared";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
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
import {
  cancelBillingSubscription,
  completeMockBillingCheckout,
  createBillingPortal,
} from "@/lib/api-client";

export default function MockCheckoutClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");
  const mode = searchParams.get("mode");
  const returnUrl =
    searchParams.get("returnUrl") ?? "/settings#plan?billing=success";
  const isManage = mode === "manage";
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (!sessionId) {
      return;
    }
    setBusy(true);
    try {
      await completeMockBillingCheckout({ sessionId });
      toast.success("Subscription activated (mock)");
      router.push(
        returnUrl.includes("billing=success")
          ? returnUrl
          : `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}billing=success`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not complete checkout"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelSubscription() {
    setBusy(true);
    try {
      await cancelBillingSubscription({ atPeriodEnd: true });
      toast.success("Subscription canceled (mock)");
      router.push(returnUrl);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not cancel subscription"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenPortal() {
    setBusy(true);
    try {
      const { url } = await createBillingPortal();
      window.location.assign(url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not open billing portal"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16 sm:px-6">
      <div className="space-y-2 text-center">
        <Badge variant="secondary">Mock billing</Badge>
        <h1 className="font-display font-semibold text-3xl tracking-tight">
          {isManage ? "Manage subscription" : "Mock checkout"}
        </h1>
        <p className="text-muted-foreground text-sm">
          No real payment is collected. This page simulates a payment gateway
          during development.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isManage ? "Billing portal (mock)" : "Confirm your plan"}
          </CardTitle>
          <CardDescription>
            {isManage
              ? "Cancel at period end — paid access stays active until the current billing period ends."
              : sessionId
                ? `Session ${sessionId}`
                : "Missing checkout session."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {isManage ? (
            <>
              <Button
                disabled={busy}
                onClick={handleCancelSubscription}
                type="button"
                variant="outline"
              >
                Cancel subscription
              </Button>
              <Button asChild disabled={busy} type="button" variant="outline">
                <Link href={returnUrl}>Back to settings</Link>
              </Button>
            </>
          ) : sessionId ? (
            <>
              <Button disabled={busy} onClick={handleConfirm} type="button">
                Confirm payment (mock)
              </Button>
              <Button asChild disabled={busy} type="button" variant="outline">
                <Link href="/pricing">Cancel</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild type="button" variant="outline">
                <Link href="/pricing">Back to pricing</Link>
              </Button>
              <Button
                disabled={busy}
                onClick={handleOpenPortal}
                type="button"
                variant="outline"
              >
                Open manage mode
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-muted-foreground text-xs">
        Tiers: {Object.values(TIER_DISPLAY_NAMES).join(" · ")}
      </p>
    </div>
  );
}
