"use client";

import {
  type CharacterSpec,
  FIELD_CATALOG,
  formatValue,
  getPath,
  humanize,
  isEmpty,
  SECTION_TITLES,
} from "@charator/spec";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_SECTION_ORDER } from "@/lib/wizard-sections";

const SECTION_LABELS: Record<string, string> = {
  ...SECTION_TITLES,
  generation: "Generation",
  meta: "Basics",
};

interface SpecViewerProps {
  spec: CharacterSpec;
}

export function SpecViewer({ spec }: SpecViewerProps) {
  return (
    <div className="space-y-3">
      {WIZARD_SECTION_ORDER.map((sectionId) => {
        const fields = FIELD_CATALOG.filter((field) => {
          const [top] = field.path.split(".");
          return top === sectionId;
        }).filter((field) => !isEmpty(getPath(spec, field.path)));

        if (fields.length === 0) {
          return null;
        }

        return (
          <details
            className="group rounded-lg border bg-card/40"
            key={sectionId}
            open={sectionId === "meta" || sectionId === "identity"}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium text-sm [&::-webkit-details-marker]:hidden">
              <span>{SECTION_LABELS[sectionId] ?? sectionId}</span>
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <dl className="space-y-2 border-t px-4 py-3">
              {fields.map((field) => (
                <div
                  className="grid gap-1 sm:grid-cols-[minmax(8rem,12rem)_1fr]"
                  key={field.path}
                >
                  <dt className="text-muted-foreground text-xs">
                    {field.label ??
                      humanize(field.path.split(".").at(-1) ?? field.path)}
                  </dt>
                  <dd className="text-sm">
                    {formatValue(getPath(spec, field.path))}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        );
      })}
    </div>
  );
}

export function CharacterSummary({
  className,
  spec,
  themeLabel,
}: {
  className?: string;
  spec: CharacterSpec;
  themeLabel: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      <SummaryTile label="Name" value={spec.meta.name || "Untitled"} />
      <SummaryTile label="Theme" value={themeLabel} />
      <SummaryTile label="Gender" value={spec.identity.gender || "—"} />
      <SummaryTile label="Role" value={spec.archetype.role || "—"} />
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card/60 p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-medium text-sm">{value}</p>
    </div>
  );
}
