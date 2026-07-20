import { describe, expect, test } from "bun:test";
import { createEmptySpec } from "../src/empty";
import { embedPngTextChunks, readPngTextChunk } from "../src/png-text";
import {
  composeStCardDescription,
  composeStCardMesExample,
  composeStCardPostHistoryInstructions,
  composeStCardSystemPrompt,
  encodeStCardChunks,
  exportStCard,
  importStCardFromJson,
  listUnmappedStFields,
  ST_CARD_SPEC,
} from "../src/st-card";
import { importStCardFromPng } from "../src/st-card-png";

const MINIMAL_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
);

describe("st-card import/export", () => {
  test("maps CCv3 JSON fields with lossy manifest", () => {
    const card = {
      data: {
        alternate_greetings: ["Hi there"],
        creator: "Ada",
        creator_notes: "Handle with care",
        description: "A brave knight",
        first_mes: "Hello!",
        group_only_greetings: [],
        mes_example: "<START>",
        name: "Sir Galahad",
        personality: "Stoic and kind",
        scenario: "Camelot court",
        system_prompt: "Stay in character",
        tags: ["fantasy", "knight"],
      },
      spec: "chara_card_v3",
      spec_version: "3.0",
    };

    const result = importStCardFromJson(card);
    expect(result.sourceFormat).toBe("ccv3-json");
    expect(result.reviewRequired).toBe(true);
    expect(result.spec.meta.name).toBe("Sir Galahad");
    expect(result.spec.meta.tags).toEqual(["fantasy", "knight"]);
    expect(result.spec.control.freeform.overall).toBe("A brave knight");
    expect(result.spec.personality.demeanor_notes).toBe("Stoic and kind");

    const mappedFields = new Set(
      result.lossyFields.map((entry) => entry.field)
    );
    expect(mappedFields.has("data.first_mes")).toBe(true);
    expect(mappedFields.has("data.mes_example")).toBe(true);
    expect(mappedFields.has("data.system_prompt")).toBe(true);
    expect(
      result.lossyFields.find((entry) => entry.field === "data.mes_example")
        ?.destination
    ).toBe("control.st.mes_example");
    expect(
      result.lossyFields.find((entry) => entry.field === "data.first_mes")
        ?.destination
    ).toBe("meta.notes");
    expect(result.spec.control.st.system_prompt).toBe("Stay in character");
    expect(result.spec.control.st.mes_example).toBe("<START>");
    expect(
      listUnmappedStFields(result.lossyFields).some(
        (entry) => entry.field === "data.first_mes"
      )
    ).toBe(true);
  });

  test("round-trips exact spec via extensions.charator.spec", () => {
    const spec = createEmptySpec();
    spec.meta.name = "Roundtrip Hero";
    spec.meta.id = "roundtrip-hero";
    spec.identity.gender = "female";
    spec.personality.primary = "warm_cheerful";
    spec.meta.tags = ["test"];

    const exported = exportStCard(spec, "anime");
    const imported = importStCardFromJson(exported.ccv3);

    expect(imported.spec).toEqual(spec);
    expect(imported.reviewRequired).toBe(false);
    expect(imported.sourceFormat).toBe("ccv3-json");
  });

  test("exports deterministic description from spec sections", () => {
    const spec = createEmptySpec();
    spec.meta.name = "Luna";
    spec.identity.gender = "female";
    spec.appearance.hair.color = "silver";
    spec.appearance.hair.style = "long";
    spec.outfit.style.primary = "dress";

    const description = composeStCardDescription(spec);
    expect(description).toContain("Luna");
    expect(description).toContain("Identity");
    expect(description).toContain("silver");
  });

  test("reads ccv3 PNG chunk with v2 fallback", () => {
    const spec = createEmptySpec();
    spec.meta.name = "PNG Hero";
    spec.meta.id = "png-hero";
    const { ccv3, v2 } = exportStCard(spec, null);
    const chunks = encodeStCardChunks(ccv3, v2);
    const png = embedPngTextChunks(MINIMAL_PNG, chunks);

    expect(readPngTextChunk(png, "ccv3")).toBeTruthy();
    expect(readPngTextChunk(png, "chara")).toBeTruthy();

    const fromPng = importStCardFromPng(png);
    expect(fromPng.sourceFormat).toBe("ccv3-png");
    expect(fromPng.spec).toEqual(spec);
  });

  test("falls back to chara v2 PNG chunk", () => {
    const v2Only = {
      data: {
        description: "V2 card",
        name: "Legacy",
        tags: [],
      },
      spec: "chara_card_v2",
      spec_version: "2.0",
    };
    const png = embedPngTextChunks(MINIMAL_PNG, [
      {
        keyword: "chara",
        text: Buffer.from(JSON.stringify(v2Only), "utf8").toString("base64"),
      },
    ]);

    const result = importStCardFromPng(png);
    expect(result.sourceFormat).toBe("ccv2-png");
    expect(result.spec.meta.name).toBe("Legacy");
    expect(result.reviewRequired).toBe(true);
  });

  test("export embeds charator extension with spec snapshot", () => {
    const spec = createEmptySpec();
    spec.meta.name = "Extension Test";
    const { ccv3 } = exportStCard(spec, "manga");
    expect(ccv3.spec).toBe(ST_CARD_SPEC);
    const ext = ccv3.data.extensions?.charator as { spec: unknown };
    expect(ext.spec).toEqual(spec);
  });

  test("exports mes_example system_prompt and post_history from spec", () => {
    const spec = createEmptySpec();
    spec.meta.name = "Aria";
    spec.personality.demeanor_notes = "Playful and curious";
    spec.control.freeform.setting = "Moonlit library";
    spec.control.st.system_prompt = "Custom system prompt";
    spec.control.st.mes_example = "<START>\n{{user}}: Hi\n{{char}}: Hello!";
    spec.control.st.post_history_instructions = "Stay whimsical.";

    const { ccv3 } = exportStCard(spec, null);
    expect(ccv3.data.mes_example).toBe(spec.control.st.mes_example);
    expect(ccv3.data.system_prompt).toBe("Custom system prompt");
    expect(ccv3.data.post_history_instructions).toBe("Stay whimsical.");
  });

  test("generates mes_example when control.st is empty", () => {
    const spec = createEmptySpec();
    spec.meta.name = "Nova";
    spec.personality.demeanor_notes = "Calm mentor energy";
    spec.control.freeform.setting = "Training hall";

    const example = composeStCardMesExample(spec);
    expect(example).toContain("<START>");
    expect(example).toContain("{{user}}");
    expect(example).toContain("{{char}}");
    expect(example).toContain("Nova");

    const { ccv3 } = exportStCard(spec, null);
    expect(ccv3.data.mes_example).toContain("Nova");
    expect(composeStCardSystemPrompt(spec)).toContain("Nova");
    expect(composeStCardPostHistoryInstructions(spec)).toContain("Nova");
  });

  test("restores embedded spec when control.st is partially present", () => {
    const spec = createEmptySpec();
    spec.meta.name = "Partial ST";
    spec.meta.id = "partial-st";
    spec.control.st.system_prompt = "Only prompt saved";

    const exported = exportStCard(spec, null);
    const ext = exported.ccv3.data.extensions?.charator as {
      spec: Record<string, unknown>;
    };
    const embeddedControl = (ext.spec.control as Record<string, unknown>) ?? {};
    ext.spec = {
      ...ext.spec,
      control: {
        ...embeddedControl,
        st: { system_prompt: "Only prompt saved" },
      },
    };

    const imported = importStCardFromJson(exported.ccv3);
    expect(imported.reviewRequired).toBe(false);
    expect(imported.spec.control.st.system_prompt).toBe("Only prompt saved");
    expect(imported.spec.control.st.mes_example).toBe("");
    expect(imported.spec.control.st.post_history_instructions).toBe("");
  });

  test("round-trips control.st fields via charator extension", () => {
    const spec = createEmptySpec();
    spec.meta.name = "ST Depth";
    spec.meta.id = "st-depth";
    spec.control.st.mes_example = "<START>\n{{user}}: ping\n{{char}}: pong";
    spec.control.st.system_prompt = "Be concise.";
    spec.control.st.post_history_instructions = "No spoilers.";

    const exported = exportStCard(spec, "anime");
    const imported = importStCardFromJson(exported.ccv3);

    expect(imported.spec.control.st).toEqual(spec.control.st);
    expect(imported.reviewRequired).toBe(false);
  });

  test("records lorebook as unsupported without dumping into notes", () => {
    const card = {
      data: {
        character_book: { entries: [{ content: "secret", keys: ["magic"] }] },
        description: "A witch",
        name: "Lore Witch",
        tags: [],
      },
      spec: "chara_card_v3",
      spec_version: "3.0",
    };

    const result = importStCardFromJson(card);
    expect(result.spec.meta.notes).not.toContain("Character book");
    expect(
      result.lossyFields.some(
        (entry) =>
          entry.field === "data.character_book" &&
          entry.destination.includes("unsupported")
      )
    ).toBe(true);
  });
});
