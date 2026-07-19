/** Character sheet batch presets — deterministic spec transforms per variant. */

import type { CharacterSpec } from "./schema";
import type { ThemeId } from "./themes";
import { renderPrompt } from "./themes";

export const SHEET_PRESET_IDS = ["turnaround", "expressions", "poses"] as const;

export type SheetPresetId = (typeof SHEET_PRESET_IDS)[number];

export interface SheetVariantDefinition {
  apply: (spec: CharacterSpec) => void;
  id: string;
  label: string;
}

export interface SheetPresetDefinition {
  defaultVariantCount: number;
  description: string;
  id: SheetPresetId;
  label: string;
  variants: SheetVariantDefinition[];
}

const IDENTITY_LOCK_SECTIONS = ["identity", "appearance", "outfit"] as const;

const IDENTITY_LOCK_PATHS = [
  "identity.age_range",
  "identity.gender",
  "identity.ethnicity_appearance",
  "identity.vibe_keywords",
  "appearance.body.type",
  "appearance.hair.color",
  "appearance.hair.style",
  "appearance.eyes.color",
  "appearance.face.shape",
  "appearance.skin.tone",
  "outfit.style.primary",
  "outfit.silhouette",
  "outfit.pieces.top",
  "outfit.pieces.bottom",
] as const;

function lockIdentitySections(spec: CharacterSpec): void {
  for (const section of IDENTITY_LOCK_SECTIONS) {
    spec.control.section_modes[section] = "strict";
  }
  const locked = new Set(spec.control.locked);
  for (const path of IDENTITY_LOCK_PATHS) {
    locked.add(path);
  }
  spec.control.locked = [...locked];
}

function cloneSpec(base: CharacterSpec): CharacterSpec {
  return JSON.parse(JSON.stringify(base)) as CharacterSpec;
}

export const SHEET_PRESETS: Record<SheetPresetId, SheetPresetDefinition> = {
  expressions: {
    defaultVariantCount: 6,
    description:
      "Neutral, happy, angry, sad, surprised, and smug expression variants.",
    id: "expressions",
    label: "Expressions",
    variants: [
      {
        apply(spec) {
          spec.pose.expression = "neutral";
          spec.pose.mouth = "closed";
          spec.framing.shot = "portrait";
        },
        id: "neutral",
        label: "Neutral",
      },
      {
        apply(spec) {
          spec.pose.expression = "smile";
          spec.pose.mouth = "grin";
          spec.framing.shot = "portrait";
        },
        id: "happy",
        label: "Happy",
      },
      {
        apply(spec) {
          spec.pose.expression = "angry";
          spec.pose.mouth = "closed";
          spec.framing.shot = "portrait";
        },
        id: "angry",
        label: "Angry",
      },
      {
        apply(spec) {
          spec.pose.expression = "sad";
          spec.pose.mouth = "closed";
          spec.framing.shot = "portrait";
        },
        id: "sad",
        label: "Sad",
      },
      {
        apply(spec) {
          spec.pose.expression = "surprised";
          spec.pose.mouth = "open";
          spec.framing.shot = "portrait";
        },
        id: "surprised",
        label: "Surprised",
      },
      {
        apply(spec) {
          spec.pose.expression = "smirk";
          spec.pose.mouth = "smirk";
          spec.framing.shot = "portrait";
        },
        id: "smug",
        label: "Smug",
      },
    ],
  },
  poses: {
    defaultVariantCount: 4,
    description: "Standing, action, sitting, and walking pose variants.",
    id: "poses",
    label: "Poses",
    variants: [
      {
        apply(spec) {
          spec.pose.body = "standing";
          spec.pose.energy = "calm";
          spec.framing.shot = "full_body";
        },
        id: "standing",
        label: "Standing",
      },
      {
        apply(spec) {
          spec.pose.body = "weapon_ready";
          spec.pose.energy = "high";
          spec.framing.shot = "full_body";
        },
        id: "action",
        label: "Action",
      },
      {
        apply(spec) {
          spec.pose.body = "sitting";
          spec.pose.energy = "calm";
          spec.framing.shot = "full_body";
        },
        id: "sitting",
        label: "Sitting",
      },
      {
        apply(spec) {
          spec.pose.body = "walking";
          spec.pose.energy = "moderate";
          spec.framing.shot = "full_body";
        },
        id: "walking",
        label: "Walking",
      },
    ],
  },
  turnaround: {
    defaultVariantCount: 4,
    description:
      "Front, three-quarter, side, and back views for a turnaround sheet.",
    id: "turnaround",
    label: "Turnaround",
    variants: [
      {
        apply(spec) {
          spec.pose.gaze = "viewer";
          spec.pose.facing = "front";
          spec.pose.body = "standing";
          spec.pose.expression = "neutral";
          spec.framing.shot = "full_body";
          spec.framing.camera_angle = "eye_level";
        },
        id: "front",
        label: "Front",
      },
      {
        apply(spec) {
          spec.pose.gaze = "viewer";
          spec.pose.facing = "three-quarter";
          spec.pose.body = "standing";
          spec.pose.expression = "neutral";
          spec.framing.shot = "three_quarter";
          spec.framing.camera_angle = "eye_level";
        },
        id: "three_quarter",
        label: "Three-quarter",
      },
      {
        apply(spec) {
          spec.pose.gaze = "off_screen";
          spec.pose.facing = "profile left";
          spec.pose.body = "standing";
          spec.pose.expression = "neutral";
          spec.framing.shot = "full_body";
          spec.framing.camera_angle = "eye_level";
        },
        id: "side",
        label: "Side",
      },
      {
        apply(spec) {
          spec.pose.gaze = "off_screen";
          spec.pose.facing = "back";
          spec.pose.body = "back_turned";
          spec.pose.expression = "neutral";
          spec.framing.shot = "full_body";
          spec.framing.camera_angle = "eye_level";
        },
        id: "back",
        label: "Back",
      },
    ],
  },
};

function negativePromptFromSpec(spec: CharacterSpec): string | undefined {
  const items = spec.generation.avoid
    .filter((item) => item.trim().length > 0)
    .map((item) => item.trim());
  return items.length > 0 ? items.join(", ") : undefined;
}

export interface SheetVariantResult {
  negativePrompt?: string;
  prompt: string;
  spec: CharacterSpec;
  variantId: string;
  variantLabel: string;
}

export function getSheetPreset(presetId: string): SheetPresetDefinition | null {
  if (!(presetId in SHEET_PRESETS)) {
    return null;
  }
  return SHEET_PRESETS[presetId as SheetPresetId];
}

export function sheetVariantCount(presetId: SheetPresetId): number {
  return SHEET_PRESETS[presetId].variants.length;
}

export function buildSheetVariants(
  baseSpec: CharacterSpec,
  presetId: SheetPresetId,
  themeId: ThemeId | null
): SheetVariantResult[] {
  const preset = SHEET_PRESETS[presetId];
  return preset.variants.map((variant) => {
    const spec = cloneSpec(baseSpec);
    lockIdentitySections(spec);
    variant.apply(spec);
    const prompt = renderPrompt(spec, themeId ? { theme: themeId } : undefined);
    return {
      negativePrompt: negativePromptFromSpec(spec),
      prompt,
      spec,
      variantId: variant.id,
      variantLabel: variant.label,
    };
  });
}

export function listSheetPresets(): SheetPresetDefinition[] {
  return SHEET_PRESET_IDS.map((id) => SHEET_PRESETS[id]);
}
