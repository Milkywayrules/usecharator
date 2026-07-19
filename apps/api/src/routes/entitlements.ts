import { db } from "../auth";
import {
  buildEntitlementsResponse,
  getWorkspaceOwnerId,
} from "../lib/entitlements";
import { requireWorkspaceContext } from "./workspaces";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export async function handleEntitlementsGet(
  request: Request
): Promise<Response> {
  const context = await requireWorkspaceContext(request);
  const ownerUserId =
    (await getWorkspaceOwnerId(db, context.workspaceId)) ?? context.user.id;
  const payload = await buildEntitlementsResponse(
    db,
    ownerUserId,
    context.workspaceId
  );
  return json(payload);
}
