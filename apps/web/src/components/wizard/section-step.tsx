"use client";

import type { CharacterSpec, FieldCatalogEntry } from "@charator/spec";
import type { Control } from "react-hook-form";
import { SpecField } from "@/components/wizard/spec-field";

interface SectionStepProps {
  control: Control<CharacterSpec>;
  errors: string[];
  fields: FieldCatalogEntry[];
  title: string;
}

function errorForPath(errors: string[], path: string): string | undefined {
  return errors.find((error) => error.includes(path));
}

export function SectionStep({
  control,
  errors,
  fields,
  title,
}: SectionStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-semibold text-2xl tracking-tight">
          {title}
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Fill in the fields below. Core fields drive the prompt most.
        </p>
      </div>
      <div className="grid gap-6">
        {fields.map((entry) => (
          <SpecField
            control={control}
            entry={entry}
            error={errorForPath(errors, entry.path)}
            key={entry.path}
          />
        ))}
      </div>
    </div>
  );
}
