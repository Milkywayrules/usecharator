/**
 * SillyTavern Character Card V3 import/export (spec revision 3.0).
 * @see https://github.com/kwaroran/character-card-spec-v3/blob/main/SPEC_V3.md
 */

import { effectiveMode, shouldIncludeField } from "./control";
import { FIELD_ORDER } from "./data/field-order";
import { SECTION_TITLES } from "./data/paths";
import { createEmptySpec } from "./empty";
import {
  type CharacterSpec,
  characterSpecSchema,
  parseCharacterSpec,
} from "./schema";
import type { ThemeId } from "./themes";
import { formatValue, humanize, isEmpty } from "./utils";
import { SPEC_VERSION } from "./validate";

export const ST_CARD_SPEC = "chara_card_v3" as const;
export const ST_CARD_SPEC_VERSION = "3.0" as const;
export const ST_CARD_V2_SPEC = "chara_card_v2" as const;
export const ST_CARD_V2_SPEC_VERSION = "2.0" as const;

export const CHARATOR_EXTENSION_KEY = "charator" as const;

export type StCardSourceFormat =
  | "ccv3-json"
  | "ccv3-png"
  | "ccv2-json"
  | "ccv2-png";

export interface LossyField {
  destination: string;
  field: string;
}

export interface ImportStCardResult {
  lossyFields: LossyField[];
  reviewRequired: boolean;
  sourceFormat: StCardSourceFormat;
  spec: CharacterSpec;
}

export interface StCardExportResult {
  ccv3: StCharacterCardV3;
  v2: StCharacterCardV2;
}

export interface StCardData {
  alternate_greetings?: string[];
  assets?: unknown[];
  character_book?: unknown;
  character_version?: string;
  creation_date?: number;
  creator?: string;
  creator_notes?: string;
  creator_notes_multilingual?: Record<string, string>;
  description?: string;
  extensions?: Record<string, unknown>;
  first_mes?: string;
  group_only_greetings?: string[];
  mes_example?: string;
  modification_date?: number;
  name?: string;
  nickname?: string;
  personality?: string;
  post_history_instructions?: string;
  scenario?: string;
  source?: string[];
  system_prompt?: string;
  tags?: string[];
}

export interface StCharacterCardV3 {
  data: StCardData;
  spec: typeof ST_CARD_SPEC;
  spec_version: typeof ST_CARD_SPEC_VERSION;
}

export interface StCharacterCardV2 {
  data: StCardData;
  spec: typeof ST_CARD_V2_SPEC;
  spec_version: typeof ST_CARD_V2_SPEC_VERSION;
}

const DESCRIPTION_SECTIONS = [
  "identity",
  "personality",
  "archetype",
  "appearance",
  "outfit",
] as const;

const NOTES_SECTION = "[SillyTavern import — review required]";

function appendNote(spec: CharacterSpec, line: string): void {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  const existing = spec.meta.notes.trim();
  spec.meta.notes = existing ? `${existing}\n${trimmed}` : trimmed;
}

function appendNotesBlock(
  spec: CharacterSpec,
  label: string,
  body: string
): void {
  const trimmed = body.trim();
  if (!trimmed) {
    return;
  }
  appendNote(spec, `${label}:\n${trimmed}`);
}

function recordLossy(
  lossyFields: LossyField[],
  field: string,
  destination: string
): void {
  lossyFields.push({ destination, field });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function detectCardEnvelope(
  input: unknown
): { card: Record<string, unknown>; sourceFormat: StCardSourceFormat } | null {
  if (!isRecord(input)) {
    return null;
  }
  const { spec } = input;
  if (spec === ST_CARD_SPEC) {
    return { card: input, sourceFormat: "ccv3-json" };
  }
  if (spec === ST_CARD_V2_SPEC) {
    return { card: input, sourceFormat: "ccv2-json" };
  }
  return null;
}

function parseCardJson(raw: unknown): {
  card: Record<string, unknown>;
  sourceFormat: StCardSourceFormat;
} {
  const direct = detectCardEnvelope(raw);
  if (direct) {
    return direct;
  }
  if (
    isRecord(raw) &&
    isRecord(raw.data) &&
    typeof raw.data.name === "string"
  ) {
    return { card: raw, sourceFormat: "ccv3-json" };
  }
  throw new Error("unrecognized character card JSON");
}

function cardData(card: Record<string, unknown>): StCardData {
  if (!isRecord(card.data)) {
    throw new Error("character card missing data object");
  }
  return card.data as StCardData;
}

function tryRestoreFromExtensions(
  data: StCardData,
  lossyFields: LossyField[]
): CharacterSpec | null {
  const { extensions } = data;
  if (!isRecord(extensions)) {
    return null;
  }
  const charator = extensions[CHARATOR_EXTENSION_KEY];
  if (!isRecord(charator) || charator.spec === undefined) {
    return null;
  }
  const parsed = characterSpecSchema.safeParse(charator.spec);
  if (!parsed.success) {
    recordLossy(
      lossyFields,
      "extensions.charator.spec",
      "not mapped (invalid embedded spec)"
    );
    return null;
  }
  const spec = parseCharacterSpec(parsed.data);
  if (typeof data.name === "string" && data.name.trim()) {
    spec.meta.name = data.name.trim();
  }
  for (const [key] of Object.entries(data)) {
    if (key === "extensions") {
      continue;
    }
    recordLossy(
      lossyFields,
      `data.${key}`,
      "extensions.charator.spec (lossless round-trip)"
    );
  }
  return spec;
}

function mapCardToSpec(
  data: StCardData,
  lossyFields: LossyField[]
): CharacterSpec {
  const spec = createEmptySpec();

  if (typeof data.name === "string" && data.name.trim()) {
    spec.meta.name = data.name.trim();
    recordLossy(lossyFields, "data.name", "meta.name");
  }

  if (Array.isArray(data.tags)) {
    spec.meta.tags = data.tags.filter(
      (tag): tag is string => typeof tag === "string" && tag.trim().length > 0
    );
    recordLossy(lossyFields, "data.tags", "meta.tags");
  }

  if (typeof data.description === "string" && data.description.trim()) {
    spec.control.freeform.overall = data.description.trim();
    recordLossy(lossyFields, "data.description", "control.freeform.overall");
  }

  if (typeof data.personality === "string" && data.personality.trim()) {
    spec.personality.demeanor_notes = data.personality.trim();
    recordLossy(lossyFields, "data.personality", "personality.demeanor_notes");
  }

  if (typeof data.scenario === "string" && data.scenario.trim()) {
    spec.control.freeform.setting = data.scenario.trim();
    recordLossy(lossyFields, "data.scenario", "control.freeform.setting");
  }

  if (typeof data.creator === "string" && data.creator.trim()) {
    spec.meta.inspiration = data.creator.trim();
    recordLossy(lossyFields, "data.creator", "meta.inspiration");
  }

  if (typeof data.creator_notes === "string" && data.creator_notes.trim()) {
    appendNote(spec, data.creator_notes.trim());
    recordLossy(lossyFields, "data.creator_notes", "meta.notes");
  }

  appendNotesBlock(spec, NOTES_SECTION, buildUnmappedNotes(data, lossyFields));
  return spec;
}

function buildUnmappedNotes(
  data: StCardData,
  lossyFields: LossyField[]
): string {
  const lines: string[] = [];

  const mapTextField = (field: keyof StCardData, label: string) => {
    const value = data[field];
    if (typeof value === "string" && value.trim()) {
      lines.push(`${label}:\n${value.trim()}`);
      recordLossy(lossyFields, `data.${String(field)}`, "meta.notes");
    }
  };

  mapTextField("first_mes", "First message");
  mapTextField("mes_example", "Message example");
  mapTextField("system_prompt", "System prompt");
  mapTextField("post_history_instructions", "Post-history instructions");
  mapTextField("nickname", "Nickname");

  if (
    typeof data.character_version === "string" &&
    data.character_version.trim()
  ) {
    lines.push(`Character version: ${data.character_version.trim()}`);
    recordLossy(lossyFields, "data.character_version", "meta.notes");
  }

  if (
    Array.isArray(data.alternate_greetings) &&
    data.alternate_greetings.length > 0
  ) {
    lines.push(
      `Alternate greetings:\n${data.alternate_greetings.join("\n---\n")}`
    );
    recordLossy(lossyFields, "data.alternate_greetings", "meta.notes");
  }

  if (
    Array.isArray(data.group_only_greetings) &&
    data.group_only_greetings.length > 0
  ) {
    lines.push(
      `Group-only greetings:\n${data.group_only_greetings.join("\n---\n")}`
    );
    recordLossy(lossyFields, "data.group_only_greetings", "meta.notes");
  }

  if (data.character_book !== undefined) {
    lines.push(
      `Character book:\n${JSON.stringify(data.character_book, null, 2)}`
    );
    recordLossy(lossyFields, "data.character_book", "meta.notes");
  }

  if (data.assets !== undefined) {
    lines.push(`Assets:\n${JSON.stringify(data.assets, null, 2)}`);
    recordLossy(lossyFields, "data.assets", "not mapped");
  }

  if (data.creator_notes_multilingual !== undefined) {
    lines.push(
      `Creator notes (multilingual):\n${JSON.stringify(data.creator_notes_multilingual, null, 2)}`
    );
    recordLossy(lossyFields, "data.creator_notes_multilingual", "not mapped");
  }

  if (Array.isArray(data.source) && data.source.length > 0) {
    lines.push(`Source: ${data.source.join(", ")}`);
    recordLossy(lossyFields, "data.source", "not mapped");
  }

  if (typeof data.creation_date === "number") {
    lines.push(`Creation date: ${data.creation_date}`);
    recordLossy(lossyFields, "data.creation_date", "not mapped");
  }

  if (typeof data.modification_date === "number") {
    lines.push(`Modification date: ${data.modification_date}`);
    recordLossy(lossyFields, "data.modification_date", "not mapped");
  }

  if (isRecord(data.extensions)) {
    for (const [key, value] of Object.entries(data.extensions)) {
      if (key === CHARATOR_EXTENSION_KEY) {
        continue;
      }
      lines.push(`Extension ${key}:\n${JSON.stringify(value, null, 2)}`);
      recordLossy(lossyFields, `data.extensions.${key}`, "not mapped");
    }
  }

  return lines.join("\n\n");
}

function walkDescriptionSection(
  section: Record<string, unknown>,
  prefix: string,
  lines: string[],
  dotPrefix: string,
  mode: string
): void {
  const orderedKeys = FIELD_ORDER[dotPrefix];
  const entries = orderedKeys
    ? orderedKeys
        .filter((key) => key in section)
        .map((key) => [key, section[key]] as const)
    : Object.entries(section);

  for (const [key, value] of entries) {
    const path = dotPrefix ? `${dotPrefix}.${key}` : key;
    if (!shouldIncludeField(path, value, mode)) {
      continue;
    }
    const label = prefix ? `${prefix}${humanize(key)}` : humanize(key);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      walkDescriptionSection(
        value as Record<string, unknown>,
        `${label} — `,
        lines,
        path,
        mode
      );
    } else if (Array.isArray(value)) {
      const items = value.filter((v) => !isEmpty(v)).map((v) => formatValue(v));
      if (items.length > 0) {
        lines.push(`${label}: ${items.join(", ")}`);
      }
    } else {
      lines.push(`${label}: ${formatValue(value)}`);
    }
  }
}

/** Deterministic ST `description` from identity / appearance / outfit sections. */
export function composeStCardDescription(spec: CharacterSpec): string {
  const parts: string[] = [];
  const name = spec.meta.name.trim() || spec.meta.id.trim() || "character";
  parts.push(name);

  for (const sectionKey of DESCRIPTION_SECTIONS) {
    const block = spec[sectionKey];
    if (typeof block !== "object" || block === null || Array.isArray(block)) {
      continue;
    }
    const title = SECTION_TITLES[sectionKey];
    const sectionMode = effectiveMode(spec, sectionKey);
    const buf: string[] = [];
    walkDescriptionSection(
      block as Record<string, unknown>,
      "",
      buf,
      sectionKey,
      sectionMode
    );
    if (buf.length > 0) {
      parts.push(`${title}: ${buf.join("; ")}`);
    }
  }

  const freeformOverall = spec.control.freeform.overall.trim();
  if (freeformOverall) {
    parts.push(freeformOverall);
  }

  return parts.join("\n\n");
}

function v2DataFromV3(data: StCardData): StCardData {
  const {
    assets: _assets,
    creator_notes_multilingual: _cnm,
    group_only_greetings: _gog,
    modification_date: _md,
    creation_date: _cd,
    nickname: _nn,
    source: _src,
    ...rest
  } = data;
  return rest;
}

export function exportStCard(
  spec: CharacterSpec,
  themeId: ThemeId | null,
  options?: { creator?: string }
): StCardExportResult {
  const description = composeStCardDescription(spec);
  const creatorNotesParts = ["Made with Chara Tor"];
  if (spec.meta.notes.trim()) {
    creatorNotesParts.push(spec.meta.notes.trim());
  }

  const data: StCardData = {
    alternate_greetings: [],
    character_version: SPEC_VERSION.toString(),
    creator: options?.creator ?? "",
    creator_notes: creatorNotesParts.join("\n\n"),
    description,
    extensions: {
      [CHARATOR_EXTENSION_KEY]: {
        spec,
        specVersion: SPEC_VERSION,
        themeId,
      },
    },
    first_mes: "",
    group_only_greetings: [],
    mes_example: "",
    name: spec.meta.name.trim() || "Untitled",
    personality: spec.personality.demeanor_notes.trim(),
    post_history_instructions: "",
    scenario: spec.control.freeform.setting.trim(),
    system_prompt: "",
    tags: [...spec.meta.tags],
  };

  const ccv3: StCharacterCardV3 = {
    data,
    spec: ST_CARD_SPEC,
    spec_version: ST_CARD_SPEC_VERSION,
  };

  const v2: StCharacterCardV2 = {
    data: v2DataFromV3(data),
    spec: ST_CARD_V2_SPEC,
    spec_version: ST_CARD_V2_SPEC_VERSION,
  };

  return { ccv3, v2 };
}

export function encodeStCardChunks(
  ccv3: StCharacterCardV3,
  v2: StCharacterCardV2
): { keyword: string; text: string }[] {
  return [
    {
      keyword: "ccv3",
      text: Buffer.from(JSON.stringify(ccv3), "utf8").toString("base64"),
    },
    {
      keyword: "chara",
      text: Buffer.from(JSON.stringify(v2), "utf8").toString("base64"),
    },
  ];
}

export function importStCardFromJson(raw: unknown): ImportStCardResult {
  const { card, sourceFormat } = parseCardJson(raw);
  return importStCardEnvelope(card, sourceFormat);
}

export function importStCardEnvelope(
  card: Record<string, unknown>,
  sourceFormat: StCardSourceFormat
): ImportStCardResult {
  const data = cardData(card);
  const lossyFields: LossyField[] = [];

  const restored = tryRestoreFromExtensions(data, lossyFields);
  const spec = restored ?? mapCardToSpec(data, lossyFields);

  if (!(restored || spec.meta.id.trim())) {
    spec.meta.id = slugify(spec.meta.name || "imported");
    recordLossy(lossyFields, "meta.id", "generated from name");
  }

  const reviewRequired =
    lossyFields.some(
      (entry) =>
        entry.destination !== "extensions.charator.spec (lossless round-trip)"
    ) || !restored;

  return {
    lossyFields,
    reviewRequired,
    sourceFormat,
    spec,
  };
}

function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 64) || "imported";
}
