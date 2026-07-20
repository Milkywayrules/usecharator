import type { Db } from "@charator/db";
import { sql } from "drizzle-orm";

export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbExecutor = Db | DbTx;

/** Serializes entitlement count+insert for one workspace within a transaction. */
export function withWorkspaceEntitlementLock<T>(
  db: Db,
  workspaceId: string,
  fn: (tx: DbTx) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${workspaceId}))`
    );
    return fn(tx);
  });
}

/** Serializes workspace-count checks for one owner within a transaction. */
export function withOwnerEntitlementLock<T>(
  db: Db,
  ownerUserId: string,
  fn: (tx: DbTx) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${ownerUserId}))`
    );
    return fn(tx);
  });
}
