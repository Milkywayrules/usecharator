"use client";

import type { OnboardingStepId } from "@charator/shared";
import {
  type OnboardingResponse,
  onboardingResponseSchema,
} from "@charator/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, CircleIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getOnboarding, seedDemoCharacter } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const STEP_LINKS: Record<OnboardingStepId, { href: string; label: string }> =
  {
    has_provider_key: { href: "/settings#keys", label: "Add key" },
    has_character: { href: "/create", label: "Create character" },
    has_generation: { href: "/library", label: "Open library" },
  };

const BANNER_DISMISS_KEY = "charator-onboarding-banner-dismissed";

export function useOnboardingQuery(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: getOnboarding,
    queryKey: ["onboarding"],
  });
}

function OnboardingChecklist({
  data,
  showSeedDemo = true,
}: {
  data: OnboardingResponse;
  showSeedDemo?: boolean;
}) {
  const queryClient = useQueryClient();
  const seedMutation = useMutation({
    mutationFn: seedDemoCharacter,
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSuccess: (result) => {
      if (result.created) {
        toast.success("Demo character created");
      } else {
        toast.message("You already have characters in this workspace");
      }
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });

  const characterStep = data.steps.find((step) => step.id === "has_character");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span>Activation progress</span>
          <span className="text-muted-foreground">{data.progress}%</span>
        </div>
        <Progress className="h-2" value={data.progress} />
      </div>
      <ul className="space-y-3">
        {data.steps.map((step) => {
          const link = STEP_LINKS[step.id];
          return (
            <li
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              data-testid={`onboarding-step-${step.id}`}
              key={step.id}
            >
              <div className="flex min-w-0 items-center gap-2">
                {step.done ? (
                  <CheckIcon
                    aria-hidden
                    className="size-4 shrink-0 text-emerald-500"
                  />
                ) : (
                  <CircleIcon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                )}
                <span className={cn(step.done && "text-muted-foreground")}>
                  {step.label}
                </span>
              </div>
              {!step.done ? (
                <Button
                  asChild
                  className="h-8 px-3 text-xs"
                  type="button"
                  variant="outline"
                >
                  <Link href={link.href}>{link.label}</Link>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {showSeedDemo && characterStep && !characterStep.done ? (
        <Button
          className="h-8"
          disabled={seedMutation.isPending}
          onClick={() => seedMutation.mutate()}
          type="button"
          variant="outline"
        >
          Add demo character
        </Button>
      ) : null}
    </div>
  );
}

export function OnboardingSettingsSection() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);
  const onboardingQuery = useOnboardingQuery(signedIn);

  if (!signedIn) {
    return null;
  }

  const data = onboardingQuery.data;
  const showSection =
    data &&
    !data.activatedAt &&
    data.progress < 100 &&
    onboardingResponseSchema.safeParse(data).success;

  if (onboardingQuery.isLoading) {
    return (
      <Card id="onboarding">
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>Loading checklist…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!showSection || !data) {
    return null;
  }

  return (
    <Card id="onboarding">
      <CardHeader>
        <CardTitle>Getting started</CardTitle>
        <CardDescription>
          Complete these steps to run your first generation. Progress is tracked
          per workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <OnboardingChecklist data={data} />
      </CardContent>
    </Card>
  );
}

export function OnboardingBanner() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);
  const onboardingQuery = useOnboardingQuery(signedIn);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(BANNER_DISMISS_KEY) === "1");
  }, []);

  const data = onboardingQuery.data;
  const visible =
    signedIn &&
    !dismissed &&
    data &&
    !data.activatedAt &&
    data.progress < 100;

  if (!visible || !data) {
    return null;
  }

  function dismissBanner() {
    sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div
      className="border-b bg-secondary/30 px-4 py-3"
      data-testid="onboarding-banner"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-sm">Finish setup ({data.progress}%)</p>
          <p className="text-muted-foreground text-xs">
            Add a provider key, create a character, then run a generation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild className="h-8 px-3 text-xs" type="button">
            <Link href="/settings#onboarding">View checklist</Link>
          </Button>
          <Button
            aria-label="Dismiss onboarding banner"
            className="size-8 px-0"
            onClick={dismissBanner}
            type="button"
            variant="outline"
          >
            <XIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
