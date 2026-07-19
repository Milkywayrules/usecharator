import { buildProviderCapabilitiesResponse } from "@charator/shared";

export function handleProviderCapabilities(): Response {
  return Response.json(buildProviderCapabilitiesResponse());
}
