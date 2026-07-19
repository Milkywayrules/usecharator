"use client";

import {
  type CharacterSpec,
  characterSpecSchema,
  setPath,
  validateSpec,
} from "@charator/spec";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PanelRightIcon,
} from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { PromptPreviewPanel } from "@/components/layout/prompt-preview-panel";
import { SaveToLibraryButton } from "@/components/library/save-to-library-button";
import { ImportSpecButton } from "@/components/spec/import-spec-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ControlStep } from "@/components/wizard/control-step";
import { GeneratePanel } from "@/components/wizard/generate-panel";
import { ReviewStep } from "@/components/wizard/review-step";
import { SectionStep } from "@/components/wizard/section-step";
import { ThemeStep } from "@/components/wizard/theme-step";
import { WizardProgress } from "@/components/wizard/wizard-progress";
import {
  getFieldsForSection,
  WIZARD_STEPS,
  type WizardSectionId,
} from "@/lib/wizard-sections";
import { useWizardStore } from "@/stores/wizard-store";

export function CreateWizard() {
  const {
    characterAnchorUrl,
    draftVersion,
    editingCharacterId,
    spec,
    themeId,
    stepIndex,
    setSpec,
    setStepIndex,
    setThemeId,
  } = useWizardStore();

  const form = useForm<CharacterSpec>({
    defaultValues: spec,
    mode: "onChange",
    resolver: zodResolver(characterSpecSchema),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: draftVersion is the explicit import/reset signal
  useEffect(() => {
    form.reset(useWizardStore.getState().spec);
  }, [draftVersion, form]);

  useEffect(() => {
    const subscription = form.watch((values) => {
      setSpec(values as CharacterSpec);
    });
    return () => subscription.unsubscribe();
  }, [form, setSpec]);

  const currentStep = WIZARD_STEPS[stepIndex];
  const validation = validateSpec(form.getValues());

  function goNext() {
    if (stepIndex < WIZARD_STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    }
  }

  function goBack() {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  }

  function applyPreset(mode: "strict" | "balanced" | "expressive") {
    const next = structuredClone(form.getValues());
    setPath(next as Record<string, unknown>, "control.mode", mode);
    form.reset(next);
    setSpec(next);
  }

  function renderStep() {
    if (!currentStep) {
      return null;
    }
    if (currentStep.id === "theme") {
      return <ThemeStep onSelect={(id) => setThemeId(id)} selected={themeId} />;
    }
    if (currentStep.id === "control") {
      return (
        <ControlStep
          control={form.control}
          onApplyPreset={applyPreset}
          spec={form.getValues()}
        />
      );
    }
    if (currentStep.id === "review") {
      return (
        <div className="space-y-8">
          <ReviewStep spec={form.getValues()} themeId={themeId} />
          <SaveToLibraryButton spec={form.getValues()} themeId={themeId} />
          <GeneratePanel
            characterAnchorUrl={characterAnchorUrl}
            characterId={editingCharacterId ?? undefined}
            spec={form.getValues()}
            themeId={themeId}
          />
        </div>
      );
    }
    const fields = getFieldsForSection(currentStep.id as WizardSectionId);
    return (
      <div className="space-y-6">
        {currentStep.id === "meta" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              Start fresh or import a saved `.charator.json` file.
            </p>
            <ImportSpecButton />
          </div>
        ) : null}
        <SectionStep
          control={form.control}
          errors={validation.errors}
          fields={fields}
          title={currentStep.title}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:gap-8 lg:px-6">
      <aside className="hidden w-56 shrink-0 lg:block">
        <WizardProgress spec={form.getValues()} stepIndex={stepIndex} />
      </aside>

      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <p className="text-muted-foreground text-sm">
            Step {stepIndex + 1} of {WIZARD_STEPS.length}: {currentStep?.title}
          </p>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="default" type="button" variant="outline">
                <PanelRightIcon />
                Prompt
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full p-0 sm:max-w-md">
              <SheetHeader className="sr-only">
                <SheetTitle>Prompt preview</SheetTitle>
              </SheetHeader>
              <PromptPreviewPanel spec={form.getValues()} themeId={themeId} />
            </SheetContent>
          </Sheet>
        </div>

        {renderStep()}

        <div className="flex items-center justify-between border-t pt-4">
          <Button
            disabled={stepIndex === 0}
            onClick={goBack}
            type="button"
            variant="outline"
          >
            <ChevronLeftIcon />
            Back
          </Button>
          {currentStep?.id === "review" ? null : (
            <Button onClick={goNext} type="button">
              Next
              <ChevronRightIcon />
            </Button>
          )}
        </div>
      </div>

      <aside className="hidden w-80 shrink-0 overflow-hidden rounded-xl border bg-card/40 lg:block xl:w-96">
        <PromptPreviewPanel
          className="h-[calc(100dvh-8rem)]"
          spec={form.getValues()}
          themeId={themeId}
        />
      </aside>
    </div>
  );
}
