"use client";

import type { GenerationJobResponse } from "@charator/shared";
import { isTerminalJobStatus } from "@charator/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  CircleIcon,
  DownloadIcon,
  Loader2Icon,
  RotateCcwIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getGenerationJob, rerollGeneration } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { getLocalKey } from "@/lib/local-keys";

const ACTIVE = new Set(["queued", "running"]);

function StatusTimeline({ job }: { job: GenerationJobResponse }) {
  const steps = [
    { id: "queued", label: "Queued" },
    { id: "running", label: "Running" },
    { id: "done", label: job.status === "failed" ? "Failed" : "Complete" },
  ] as const;

  function stepState(stepId: string): "done" | "active" | "pending" | "failed" {
    if (job.status === "failed") {
      if (stepId === "done") {
        return "failed";
      }
      if (stepId === "queued") {
        return "done";
      }
      return job.startedAt ? "done" : "pending";
    }
    if (job.status === "succeeded") {
      return "done";
    }
    if (stepId === "queued") {
      return job.status === "queued" ? "active" : "done";
    }
    if (stepId === "running") {
      return job.status === "running"
        ? "active"
        : job.startedAt
          ? "done"
          : "pending";
    }
    return "pending";
  }

  return (
    <ol className="flex flex-wrap gap-4">
      {steps.map((step) => {
        const state = stepState(step.id);
        return (
          <li className="flex items-center gap-2 text-sm" key={step.id}>
            {state === "done" ? (
              <CheckCircle2Icon className="size-4 text-accent" />
            ) : state === "active" ? (
              <Loader2Icon className="size-4 animate-spin text-accent" />
            ) : state === "failed" ? (
              <XCircleIcon className="size-4 text-destructive" />
            ) : (
              <CircleIcon className="size-4 text-muted-foreground" />
            )}
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function GenerateJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  const jobQuery = useQuery({
    queryFn: () => getGenerationJob(jobId),
    queryKey: ["generation", jobId],
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ACTIVE.has(status) ? 2000 : false;
    },
  });

  const rerollMutation = useMutation({
    mutationFn: async () => {
      const job = jobQuery.data;
      if (!job) {
        throw new Error("Job not loaded");
      }
      const body = signedIn ? {} : { apiKey: getLocalKey(job.provider) ?? "" };
      if (!(signedIn || body.apiKey)) {
        throw new Error("No stored API key — generate again from the wizard");
      }
      return rerollGeneration(jobId, body);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSuccess: (data) => {
      toast.success("Re-roll started");
      router.push(`/generate/${data.jobId}`);
    },
  });

  const job = jobQuery.data;
  const canReroll = job ? isTerminalJobStatus(job.status) : false;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <p className="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-widest">
          Generation
        </p>
        <h1 className="font-display font-semibold text-3xl tracking-tight">
          Job status
        </h1>
      </div>

      {jobQuery.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="animate-spin" />
          Loading…
        </div>
      ) : null}

      {job ? (
        <div className="space-y-6">
          <StatusTimeline job={job} />
          <p className="text-muted-foreground text-sm capitalize">
            Status: {job.status}
            {job.provider ? ` · ${job.provider}` : ""}
          </p>
          {job.error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive text-sm">
              {job.error}
            </div>
          ) : null}
          {job.imageUrls && job.imageUrls.length > 0 ? (
            <div className="grid gap-4">
              {job.imageUrls.map((url) => (
                <figure className="overflow-hidden rounded-xl border" key={url}>
                  {/* biome-ignore lint/performance/noImgElement: signed provider URL */}
                  <img
                    alt="Generated character"
                    className="w-full"
                    height={768}
                    src={url}
                    width={768}
                  />
                  <figcaption className="flex justify-end border-t p-3">
                    <Button asChild size="default" variant="outline">
                      <a
                        download
                        href={url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <DownloadIcon />
                        Download
                      </a>
                    </Button>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {canReroll ? (
          <Button
            disabled={rerollMutation.isPending}
            onClick={() => rerollMutation.mutate()}
            type="button"
          >
            {rerollMutation.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <RotateCcwIcon />
            )}
            Re-roll
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/create">Back to wizard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/library">Library</Link>
        </Button>
      </div>
    </div>
  );
}
