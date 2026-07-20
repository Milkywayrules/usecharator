import { type Db, user } from "@charator/db";
import { and, eq, isNull } from "drizzle-orm";

export async function markUserActivatedOnFirstSuccess(
  db: Db,
  userId: string | null
): Promise<void> {
  if (!userId) {
    return;
  }

  await db
    .update(user)
    .set({ activatedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(user.id, userId), isNull(user.activatedAt)));
}
