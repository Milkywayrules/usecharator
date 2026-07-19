import type { CharacterSpec, ThemeId } from "@charator/spec";
import { type DBSchema, openDB } from "idb";

export interface LocalCharacterRecord {
  id: string;
  name: string;
  spec: CharacterSpec;
  themeId: ThemeId | null;
  updatedAt: string;
}

interface CharaTorDb extends DBSchema {
  characters: {
    indexes: { "by-updated": string };
    key: string;
    value: LocalCharacterRecord;
  };
}

const DB_NAME = "charator-local";
const DB_VERSION = 1;

function getDb() {
  return openDB<CharaTorDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore("characters", { keyPath: "id" });
      store.createIndex("by-updated", "updatedAt");
    },
  });
}

export async function listLocalCharacters(): Promise<LocalCharacterRecord[]> {
  const db = await getDb();
  const rows = await db.getAllFromIndex("characters", "by-updated");
  return rows.reverse();
}

export async function getLocalCharacter(
  id: string
): Promise<LocalCharacterRecord | undefined> {
  const db = await getDb();
  return db.get("characters", id);
}

export async function saveLocalCharacter(
  record: LocalCharacterRecord
): Promise<void> {
  const db = await getDb();
  await db.put("characters", record);
}

export async function deleteLocalCharacter(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("characters", id);
}

export async function countLocalCharacters(): Promise<number> {
  const db = await getDb();
  return db.count("characters");
}
