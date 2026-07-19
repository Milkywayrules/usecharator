"use client";

import {
  type CharacterSpec,
  FIELD_CATALOG,
  QUICK_PRESETS,
  SECTION_TITLES,
} from "@charator/spec";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import { SpecField } from "@/components/wizard/spec-field";
import { getControlFields } from "@/lib/wizard-sections";

const SECTION_MODE_SECTIONS = Object.keys(SECTION_TITLES) as Array<
  keyof typeof SECTION_TITLES
>;

const LOCKABLE_PATHS = FIELD_CATALOG.map((field) => field.path).sort((a, b) =>
  a.localeCompare(b)
);

interface ControlStepProps {
  control: Control<CharacterSpec>;
  onApplyPreset: (mode: "strict" | "balanced" | "expressive") => void;
  spec: CharacterSpec;
}

export function ControlStep({
  control,
  onApplyPreset,
  spec,
}: ControlStepProps) {
  const controlFields = getControlFields().filter(
    (field) =>
      !field.path.startsWith("control.section_modes") &&
      field.path !== "control.mode"
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display font-semibold text-2xl tracking-tight">
          Generation control
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Tune how strictly the model follows your spec versus inventing
          details.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["strict", "Max control", QUICK_PRESETS.max_control],
            ["balanced", "Standard", QUICK_PRESETS.standard_control],
            ["expressive", "Minimal", QUICK_PRESETS.minimal_control],
          ] as const
        ).map(([mode, label, preset]) => (
          <Card className="py-4" key={mode}>
            <CardHeader className="px-4 pb-2">
              <CardTitle className="text-sm">{label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4">
              <p className="text-muted-foreground text-xs">
                {typeof preset.fill === "string"
                  ? preset.fill
                  : preset.fill.join(", ")}
              </p>
              <Button
                onClick={() => onApplyPreset(mode)}
                size="default"
                type="button"
                variant={spec.control.mode === mode ? "default" : "outline"}
              >
                Apply
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <SpecField
        control={control}
        entry={{
          description:
            "global strictness — how much the generator may invent unstated details",
          kind: "enum",
          label: "mode",
          options: ["strict", "balanced", "expressive"],
          path: "control.mode",
          tier: "core",
        }}
      />

      <div className="space-y-4">
        <Label>Per-section mode overrides</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {SECTION_MODE_SECTIONS.map((section) => (
            <Controller
              control={control}
              key={section}
              name={`control.section_modes.${section}`}
              render={({ field }) => (
                <div className="space-y-1.5">
                  <Label className="text-xs">{SECTION_TITLES[section]}</Label>
                  <Select
                    onValueChange={field.onChange}
                    value={String(field.value ?? "inherit")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["inherit", "strict", "balanced", "expressive"].map(
                        (option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Locked paths</Label>
        <p className="text-muted-foreground text-xs">
          Fields the generator must never override, even in expressive mode.
        </p>
        <Controller
          control={control}
          name="control.locked"
          render={({ field }) => (
            <TagInput
              onChange={field.onChange}
              placeholder="Type a path and press Enter"
              values={field.value ?? []}
            />
          )}
        />
        <details className="text-muted-foreground text-xs">
          <summary className="cursor-pointer">Browse valid paths</summary>
          <ul className="mt-2 max-h-40 overflow-y-auto font-mono text-[10px]">
            {LOCKABLE_PATHS.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        </details>
      </div>

      <div className="grid gap-6">
        {controlFields.map((entry) => (
          <SpecField control={control} entry={entry} key={entry.path} />
        ))}
      </div>
    </div>
  );
}
