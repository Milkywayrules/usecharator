/** Empty spec factory — mirrors template.empty.yaml defaults. */

import type { CharacterSpec } from "./schema";

export function createEmptySpec(
  overrides?: Partial<CharacterSpec>
): CharacterSpec {
  const base: CharacterSpec = {
    appearance: {
      body: {
        height_impression: "",
        muscle_definition: "",
        posture: "",
        proportions_notes: "",
        type: "",
      },
      eyes: {
        color: "",
        heterochromia: null,
        highlights: "",
        lashes: "",
        left_color: "",
        pupils: "",
        right_color: "",
        shape: "",
        under_eye: "",
      },
      face: {
        beauty_mark: null,
        ears: "",
        eyebrows: "",
        facial_hair: "",
        features: "",
        freckles: null,
        lips: "",
        makeup: "",
        scars: "",
        shape: "",
      },
      hair: {
        accessories: [],
        bangs: "",
        color: "",
        color_secondary: "",
        length: "",
        parting: "",
        shine: "",
        style: "",
        texture: "",
        volume: "",
      },
      skin: {
        texture: "",
        tone: "",
        undertone: "",
      },
    },
    archetype: {
      combat_style: "",
      era_setting: "",
      faction: "",
      occupation: "",
      role: "",
    },
    art: {
      color: "",
      contrast: "",
      era: "",
      film_grain: null,
      finish: "",
      lighting: "",
      line: "",
      saturation: "",
      shading: "",
      style: "",
      texture_overlay: "",
    },
    control: {
      freeform: {
        appearance: "",
        outfit: "",
        overall: "",
        setting: "",
      },
      locked: [],
      mode: "expressive",
      section_modes: {
        appearance: "inherit",
        archetype: "inherit",
        art: "inherit",
        framing: "inherit",
        identity: "inherit",
        magic: "inherit",
        outfit: "inherit",
        personality: "inherit",
        pose: "inherit",
        props: "inherit",
        setting: "inherit",
      },
    },
    framing: {
      camera_angle: "",
      composition: "",
      crop_notes: "",
      depth_of_field: "",
      shot: "",
    },
    generation: {
      aspect_ratio: "",
      avoid: [],
      mood_keywords: [],
      output_dir: "output",
      output_file: "",
      prompt_extra: "",
      reference_notes: "",
    },
    identity: {
      age_notes: "",
      age_range: "",
      ethnicity_appearance: "",
      gender: "",
      gender_notes: "",
      vibe_keywords: [],
    },
    magic: {
      cast_style: "",
      effects: [],
      element: "",
      glow: {
        color: "",
        intensity: "",
      },
      particle_density: "",
      power_level: "",
      radius: "",
      secondary_element: "",
      signature_name: "",
    },
    meta: {
      id: "",
      inspiration: "",
      name: "",
      notes: "",
      tags: [],
    },
    outfit: {
      condition: "",
      details: [],
      exposure_level: "",
      length: "",
      material: "",
      palette: {
        accent: "",
        metal: "",
        primary: "",
        secondary: "",
      },
      pattern: "",
      pieces: {
        bottom: "",
        footwear: "",
        gloves: "",
        headwear: "",
        legwear: "",
        outerwear: "",
        top: "",
      },
      silhouette: "",
      style: {
        primary: "",
        secondary: "",
      },
    },
    personality: {
      demeanor_notes: "",
      primary: "",
      secondary: [],
      social_energy: "",
      speech_impression: "",
    },
    pose: {
      body: "",
      energy: "",
      expression: "",
      facing: "",
      gaze: "",
      hands: "",
      head_tilt: "",
      legs: "",
      motion_blur: "",
      mouth: "",
      weight_shift: "",
    },
    props: {
      accessories: [],
      carry_style: "",
      floating_objects: [],
      hat: "",
      offhand: "",
      pets_familiars: [],
      weapon: "",
      weapon_detail: "",
      weapon_size: "",
    },
    setting: {
      atmosphere: [],
      background_detail: "",
      crowd_level: "",
      environment: "",
      era: "",
      foreground: [],
      lighting_source: "",
      location: "",
      season: "",
      time: "",
      weather: "",
    },
    spec_version: 2,
  };

  if (!overrides) {
    return base;
  }

  return deepMerge(base, overrides) as CharacterSpec;
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  overrides: Partial<T>
): T {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      continue;
    }
    const baseVal = result[key as keyof T];
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof baseVal === "object" &&
      baseVal !== null &&
      !Array.isArray(baseVal)
    ) {
      result[key as keyof T] = deepMerge(
        baseVal as Record<string, unknown>,
        value as Record<string, unknown>
      ) as T[keyof T];
    } else {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}
