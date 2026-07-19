"use client";

import {
  type CharacterSpec,
  createEmptySpec,
  type ThemeId,
} from "@charator/spec";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WizardState {
  loadDraft: (spec: CharacterSpec, themeId?: ThemeId | null) => void;
  reset: () => void;
  setSpec: (spec: CharacterSpec) => void;
  setStepIndex: (stepIndex: number) => void;
  setThemeId: (themeId: ThemeId | null) => void;
  spec: CharacterSpec;
  stepIndex: number;
  themeId: ThemeId | null;
}

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      loadDraft: (spec, themeId = null) => set({ spec, stepIndex: 0, themeId }),
      reset: () =>
        set({
          spec: createEmptySpec(),
          stepIndex: 0,
          themeId: null,
        }),
      setSpec: (spec) => set({ spec }),
      setStepIndex: (stepIndex) => set({ stepIndex }),
      setThemeId: (themeId) => set({ themeId }),
      spec: createEmptySpec(),
      stepIndex: 0,
      themeId: null,
    }),
    { name: "charator-wizard-draft" }
  )
);
