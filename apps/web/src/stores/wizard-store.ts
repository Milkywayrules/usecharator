"use client";

import {
  type CharacterSpec,
  createEmptySpec,
  type ThemeId,
} from "@charator/spec";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WizardState {
  characterAnchorUrl: string | null;
  draftVersion: number;
  editingCharacterId: string | null;
  loadDraft: (
    spec: CharacterSpec,
    themeId?: ThemeId | null,
    context?: { anchorUrl?: string | null; characterId?: string }
  ) => void;
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
      characterAnchorUrl: null,
      draftVersion: 0,
      editingCharacterId: null,
      loadDraft: (spec, themeId: ThemeId | null = null, context?) =>
        set((state) => ({
          characterAnchorUrl: context?.anchorUrl ?? null,
          draftVersion: state.draftVersion + 1,
          editingCharacterId: context?.characterId ?? null,
          spec,
          stepIndex: 0,
          themeId,
        })),
      reset: () =>
        set((state) => ({
          characterAnchorUrl: null,
          draftVersion: state.draftVersion + 1,
          editingCharacterId: null,
          spec: createEmptySpec(),
          stepIndex: 0,
          themeId: null,
        })),
      setSpec: (spec) => set({ spec }),
      setStepIndex: (stepIndex) => set({ stepIndex }),
      setThemeId: (themeId) => set({ themeId }),
      spec: createEmptySpec(),
      stepIndex: 0,
      themeId: null,
    }),
    {
      name: "charator-wizard-draft",
      partialize: (state) => ({
        spec: state.spec,
        stepIndex: state.stepIndex,
        themeId: state.themeId,
      }),
    }
  )
);
