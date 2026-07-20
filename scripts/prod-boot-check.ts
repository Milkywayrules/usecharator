#!/usr/bin/env bun
/**
 * Validate a production env file against harness #7 STOP keys before deploy.
 *
 * Usage:
 *   bun scripts/prod-boot-check.ts --env .env.production
 *   bun scripts/prod-boot-check.ts --env .env.production --warn
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseEnvFile,
  productionGuardFromEnv,
  validateProductionStopKeys,
} from "../apps/api/src/lib/prod-env-file-check";
import { getProductionWarnMissing } from "../apps/api/src/lib/startup-guards";

function printUsage(): never {
  console.error("usage: bun scripts/prod-boot-check.ts --env <path> [--warn]");
  process.exit(1);
}

function parseArgs(argv: string[]): { envPath: string; warn: boolean } {
  let envPath: string | undefined;
  let warn = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env") {
      envPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--warn") {
      warn = true;
    }
  }

  if (!envPath) {
    printUsage();
  }

  return { envPath, warn };
}

function main(): void {
  const { envPath, warn } = parseArgs(process.argv.slice(2));
  const absolutePath = resolve(envPath);
  const content = readFileSync(absolutePath, "utf8");
  const env = parseEnvFile(content);
  const violations = validateProductionStopKeys(env);

  if (violations.length > 0) {
    console.error(
      `production boot check failed — missing or invalid STOP env (${absolutePath}):`
    );
    for (const key of violations) {
      console.error(`  - ${key}`);
    }
    process.exit(1);
  }

  console.log(`production boot check passed (${absolutePath})`);

  if (warn) {
    const missing = getProductionWarnMissing(productionGuardFromEnv(env));
    if (missing.length > 0) {
      console.warn(
        "optional integrations unset (boot continues; see /api/health missing list):"
      );
      for (const key of missing) {
        console.warn(`  - ${key}`);
      }
    }
  }
}

main();
