import {
  FIELD_CATALOG,
  type FieldCatalogEntry,
  SECTION_TITLES,
} from "@charator/spec";

export const WIZARD_SECTION_ORDER = [
  "meta",
  "identity",
  "personality",
  "archetype",
  "appearance",
  "outfit",
  "magic",
  "pose",
  "framing",
  "setting",
  "props",
  "art",
  "generation",
] as const;

export type WizardSectionId = (typeof WIZARD_SECTION_ORDER)[number];

export type WizardStepId = WizardSectionId | "theme" | "control" | "review";

const SECTION_LABELS: Record<string, string> = {
  ...SECTION_TITLES,
  generation: "Generation",
  meta: "Basics",
};

export interface WizardStep {
  id: WizardStepId;
  title: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  ...WIZARD_SECTION_ORDER.map((id) => ({
    id,
    title: SECTION_LABELS[id] ?? id,
  })),
  { id: "theme", title: "Visual theme" },
  { id: "control", title: "Generation control" },
  { id: "review", title: "Review & generate" },
];

export function getFieldsForSection(
  section: WizardSectionId
): FieldCatalogEntry[] {
  return FIELD_CATALOG.filter((field) => {
    const [top] = field.path.split(".");
    return top === section;
  });
}

export function getControlFields(): FieldCatalogEntry[] {
  return FIELD_CATALOG.filter((field) => field.path.startsWith("control."));
}

export function stepIndexForId(id: WizardStepId): number {
  return WIZARD_STEPS.findIndex((step) => step.id === id);
}
