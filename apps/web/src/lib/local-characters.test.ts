import "fake-indexeddb/auto";
import { beforeEach, expect, test } from "bun:test";
import { createEmptySpec } from "@charator/spec";
import {
  deleteLocalCharacter,
  listLocalCharacters,
  saveLocalCharacter,
} from "./local-characters";

beforeEach(() => {
  indexedDB.deleteDatabase("charator-local");
});

test("local characters persist in indexeddb", async () => {
  const spec = createEmptySpec();
  spec.meta.name = "Test Hero";

  await saveLocalCharacter({
    id: "char-1",
    name: "Test Hero",
    spec,
    themeId: "anime",
    updatedAt: new Date().toISOString(),
  });

  const rows = await listLocalCharacters();
  expect(rows).toHaveLength(1);
  expect(rows[0]?.name).toBe("Test Hero");
  expect(rows[0]?.themeId).toBe("anime");

  await deleteLocalCharacter("char-1");
  expect(await listLocalCharacters()).toHaveLength(0);
});
