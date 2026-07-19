"use client";

import type { CharacterSpec } from "@charator/spec";
import { CORE_PATHS, countCoreFilled } from "@charator/spec";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "@/lib/wizard-sections";

interface WizardProgressProps {
  spec: CharacterSpec;
  stepIndex: number;
}

export function WizardProgress({ spec, stepIndex }: WizardProgressProps) {
  const coreFilled = countCoreFilled(spec);
  const coreTotal = CORE_PATHS.length;
  const corePercent = Math.round((coreFilled / coreTotal) * 100);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Core fields</span>
          <span className="font-medium tabular-nums">
            {coreFilled}/{coreTotal}
          </span>
        </div>
        <Progress value={corePercent} />
      </div>
      <ol className="hidden gap-1 lg:grid">
        {WIZARD_STEPS.map((step, index) => (
          <li
            className={cn(
              "truncate rounded-md px-2 py-1 text-xs transition-colors",
              index === stepIndex
                ? "bg-accent/15 font-medium text-accent"
                : index < stepIndex
                  ? "text-muted-foreground"
                  : "text-muted-foreground/60"
            )}
            key={step.id}
          >
            {index + 1}. {step.title}
          </li>
        ))}
      </ol>
    </div>
  );
}
