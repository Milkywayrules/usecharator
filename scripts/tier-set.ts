#!/usr/bin/env bun
/**
 * Manually assign a pricing tier to a user (no payment provider in v7).
 *
 * Usage: bun run tier:set --user <email-or-id> --tier pro
 */

import { createDb, user } from "@charator/db";
import { parseTierId, TIER_IDS, type TierId } from "@charator/shared";
import { eq, or } from "drizzle-orm";

function printUsage(): never {
  console.error(
    "usage: bun run tier:set --user <email-or-id> --tier <free|plus|pro|studio>"
  );
  process.exit(1);
}

function parseArgs(argv: string[]): { tier: TierId; userRef: string } {
  let userRef: string | undefined;
  let tierRaw: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--user") {
      userRef = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--tier") {
      tierRaw = argv[index + 1];
      index += 1;
    }
  }

  if (!(userRef && tierRaw)) {
    printUsage();
  }

  const tier = parseTierId(tierRaw);
  if (!TIER_IDS.includes(tier) || tierRaw !== tier) {
    console.error(
      `invalid tier: ${tierRaw} (expected one of ${TIER_IDS.join(", ")})`
    );
    process.exit(1);
  }

  return { tier, userRef };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const { tier, userRef } = parseArgs(process.argv.slice(2));
  const { client, db } = createDb(databaseUrl);

  try {
    const [row] = await db
      .select({ email: user.email, id: user.id, tier: user.tier })
      .from(user)
      .where(or(eq(user.id, userRef), eq(user.email, userRef)))
      .limit(1);

    if (!row) {
      console.error(`user not found: ${userRef}`);
      process.exit(1);
    }

    await db.update(user).set({ tier }).where(eq(user.id, row.id));

    console.log(`updated ${row.email} (${row.id}): ${row.tier} -> ${tier}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
