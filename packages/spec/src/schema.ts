/** Zod schemas for character spec v2. */

import { z } from "zod";
import { ENUM_FIELDS } from "./data/enums";

function enumOrEmpty<const T extends readonly string[]>(values: T) {
  return z.union([
    z.enum(values as unknown as [string, ...string[]]),
    z.literal(""),
  ]);
}

function enumFromPath(path: keyof typeof ENUM_FIELDS) {
  return enumOrEmpty(ENUM_FIELDS[path]);
}

const boolOrNull = z.union([z.boolean(), z.null()]);

const controlFreeformSchema = z.object({
  appearance: z.string(),
  outfit: z.string(),
  overall: z.string(),
  setting: z.string(),
});

const controlStSchema = z.object({
  mes_example: z.string(),
  post_history_instructions: z.string(),
  system_prompt: z.string(),
});

const controlSchema = z.object({
  freeform: controlFreeformSchema,
  locked: z.array(z.string()),
  mode: enumFromPath("control.mode"),
  section_modes: z.object({
    appearance: enumFromPath("control.section_modes"),
    archetype: enumFromPath("control.section_modes"),
    art: enumFromPath("control.section_modes"),
    framing: enumFromPath("control.section_modes"),
    identity: enumFromPath("control.section_modes"),
    magic: enumFromPath("control.section_modes"),
    outfit: enumFromPath("control.section_modes"),
    personality: enumFromPath("control.section_modes"),
    pose: enumFromPath("control.section_modes"),
    props: enumFromPath("control.section_modes"),
    setting: enumFromPath("control.section_modes"),
  }),
  st: controlStSchema,
});

const metaSchema = z.object({
  id: z.string(),
  inspiration: z.string(),
  name: z.string(),
  notes: z.string(),
  tags: z.array(z.string()),
});

const identitySchema = z.object({
  age_notes: z.string(),
  age_range: enumFromPath("identity.age_range"),
  ethnicity_appearance: z.string(),
  gender: enumFromPath("identity.gender"),
  gender_notes: z.string(),
  vibe_keywords: z.array(z.string()),
});

const personalitySchema = z.object({
  demeanor_notes: z.string(),
  primary: enumFromPath("personality.primary"),
  secondary: z.array(z.string()),
  social_energy: z.string(),
  speech_impression: z.string(),
});

const archetypeSchema = z.object({
  combat_style: enumFromPath("archetype.combat_style"),
  era_setting: z.string(),
  faction: z.string(),
  occupation: z.string(),
  role: enumFromPath("archetype.role"),
});

const appearanceSchema = z.object({
  body: z.object({
    height_impression: enumFromPath("appearance.body.height_impression"),
    muscle_definition: z.string(),
    posture: enumFromPath("appearance.body.posture"),
    proportions_notes: z.string(),
    type: enumFromPath("appearance.body.type"),
  }),
  eyes: z.object({
    color: enumFromPath("appearance.eyes.color"),
    heterochromia: boolOrNull,
    highlights: z.string(),
    lashes: z.string(),
    left_color: z.string(),
    pupils: enumFromPath("appearance.eyes.pupils"),
    right_color: z.string(),
    shape: enumFromPath("appearance.eyes.shape"),
    under_eye: z.string(),
  }),
  face: z.object({
    beauty_mark: boolOrNull,
    ears: z.string(),
    eyebrows: z.string(),
    facial_hair: z.string(),
    features: enumFromPath("appearance.face.features"),
    freckles: boolOrNull,
    lips: z.string(),
    makeup: enumFromPath("appearance.face.makeup"),
    scars: enumFromPath("appearance.face.scars"),
    shape: enumFromPath("appearance.face.shape"),
  }),
  hair: z.object({
    accessories: z.array(z.string()),
    bangs: enumFromPath("appearance.hair.bangs"),
    color: enumFromPath("appearance.hair.color"),
    color_secondary: z.string(),
    length: enumFromPath("appearance.hair.length"),
    parting: z.string(),
    shine: z.string(),
    style: enumFromPath("appearance.hair.style"),
    texture: z.string(),
    volume: z.string(),
  }),
  skin: z.object({
    texture: z.string(),
    tone: enumFromPath("appearance.skin.tone"),
    undertone: enumFromPath("appearance.skin.undertone"),
  }),
});

const outfitSchema = z.object({
  condition: z.string(),
  details: z.array(z.string()),
  exposure_level: z.string(),
  length: enumFromPath("outfit.length"),
  material: z.string(),
  palette: z.object({
    accent: z.string(),
    metal: z.string(),
    primary: z.string(),
    secondary: z.string(),
  }),
  pattern: z.string(),
  pieces: z.object({
    bottom: z.string(),
    footwear: z.string(),
    gloves: enumFromPath("outfit.pieces.gloves"),
    headwear: z.string(),
    legwear: z.string(),
    outerwear: z.string(),
    top: z.string(),
  }),
  silhouette: enumFromPath("outfit.silhouette"),
  style: z.object({
    primary: enumFromPath("outfit.style.primary"),
    secondary: z.string(),
  }),
});

const magicSchema = z.object({
  cast_style: enumFromPath("magic.cast_style"),
  effects: z.array(z.string()),
  element: enumFromPath("magic.element"),
  glow: z.object({
    color: z.string(),
    intensity: enumFromPath("magic.glow.intensity"),
  }),
  particle_density: z.string(),
  power_level: enumFromPath("magic.power_level"),
  radius: z.string(),
  secondary_element: z.string(),
  signature_name: z.string(),
});

const poseSchema = z.object({
  body: enumFromPath("pose.body"),
  energy: enumFromPath("pose.energy"),
  expression: enumFromPath("pose.expression"),
  facing: z.string(),
  gaze: enumFromPath("pose.gaze"),
  hands: enumFromPath("pose.hands"),
  head_tilt: z.string(),
  legs: z.string(),
  motion_blur: z.string(),
  mouth: enumFromPath("pose.mouth"),
  weight_shift: z.string(),
});

const framingSchema = z.object({
  camera_angle: enumFromPath("framing.camera_angle"),
  composition: enumFromPath("framing.composition"),
  crop_notes: z.string(),
  depth_of_field: z.string(),
  shot: enumFromPath("framing.shot"),
});

const settingSchema = z.object({
  atmosphere: z.array(z.string()),
  background_detail: enumFromPath("setting.background_detail"),
  crowd_level: z.string(),
  environment: enumFromPath("setting.environment"),
  era: z.string(),
  foreground: z.array(z.string()),
  lighting_source: z.string(),
  location: enumFromPath("setting.location"),
  season: z.string(),
  time: enumFromPath("setting.time"),
  weather: enumFromPath("setting.weather"),
});

const propsSchema = z.object({
  accessories: z.array(z.string()),
  carry_style: z.string(),
  floating_objects: z.array(z.string()),
  hat: enumFromPath("props.hat"),
  offhand: z.string(),
  pets_familiars: z.array(z.string()),
  weapon: enumFromPath("props.weapon"),
  weapon_detail: z.string(),
  weapon_size: z.string(),
});

const artSchema = z.object({
  color: enumFromPath("art.color"),
  contrast: z.string(),
  era: enumFromPath("art.era"),
  film_grain: boolOrNull,
  finish: enumFromPath("art.finish"),
  lighting: enumFromPath("art.lighting"),
  line: enumFromPath("art.line"),
  saturation: z.string(),
  shading: enumFromPath("art.shading"),
  style: enumFromPath("art.style"),
  texture_overlay: z.string(),
});

const generationSchema = z.object({
  aspect_ratio: enumFromPath("generation.aspect_ratio"),
  avoid: z.array(z.string()),
  mood_keywords: z.array(z.string()),
  output_dir: z.string(),
  output_file: z.string(),
  prompt_extra: z.string(),
  reference_notes: z.string(),
});

export const characterSpecSchema = z.object({
  appearance: appearanceSchema,
  archetype: archetypeSchema,
  art: artSchema,
  control: controlSchema,
  framing: framingSchema,
  generation: generationSchema,
  identity: identitySchema,
  magic: magicSchema,
  meta: metaSchema,
  outfit: outfitSchema,
  personality: personalitySchema,
  pose: poseSchema,
  props: propsSchema,
  setting: settingSchema,
  spec_version: z.literal(2),
});

export type CharacterSpec = z.infer<typeof characterSpecSchema>;

const EMPTY_CONTROL_ST = {
  mes_example: "",
  post_history_instructions: "",
  system_prompt: "",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function withControlStDefaults(input: unknown): unknown {
  if (!(isRecord(input) && isRecord(input.control))) {
    return input;
  }
  if (isRecord(input.control.st)) {
    return input;
  }
  return {
    ...input,
    control: {
      ...input.control,
      st: { ...EMPTY_CONTROL_ST },
    },
  };
}

export function parseCharacterSpec(input: unknown): CharacterSpec {
  return characterSpecSchema.parse(withControlStDefaults(input));
}

export function safeParseCharacterSpec(input: unknown): CharacterSpec | null {
  try {
    return parseCharacterSpec(input);
  } catch {
    return null;
  }
}
