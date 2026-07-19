import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// guards against a migration .sql file existing without a journal entry —
// drizzle-kit migrate silently skips such files, so tables never reach the DB.
const DRIZZLE_DIR = join(import.meta.dir, "..", "drizzle");
const SQL_EXTENSION_RE = /\.sql$/;

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

describe("drizzle migration journal", () => {
  test("every migration file has an in-order journal entry", () => {
    const migrationTags = readdirSync(DRIZZLE_DIR)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => name.replace(SQL_EXTENSION_RE, ""))
      .sort();

    const journal = JSON.parse(
      readFileSync(join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8")
    ) as { entries: JournalEntry[] };

    expect(journal.entries.map((entry) => entry.tag)).toEqual(migrationTags);

    for (const [position, entry] of journal.entries.entries()) {
      expect(entry.idx).toBe(position);
      if (position > 0) {
        const previous = journal.entries[position - 1];
        expect(previous).toBeDefined();
        expect(entry.when).toBeGreaterThan(previous?.when ?? 0);
      }
    }
  });
});
