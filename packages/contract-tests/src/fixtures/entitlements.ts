import { MatchersV3 } from "@pact-foundation/pact";

const { like } = MatchersV3;

export const entitlementsUsagePactBody = {
  anchorImages: like(0),
  apiTokens: like(0),
  characters: like(0),
  generationsThisMonth: like(0),
  sheetBatchesThisMonth: like(0),
  storedGenerations: like(0),
  workspaces: like(0),
};

export const entitlementsLimitsPactBody = {
  anchorImagesPerWorkspace: like(10),
  apiTokensPerWorkspace: like(1),
  authenticatedGenerationsPerHour: like(60),
  charactersPerWorkspace: like(15),
  sheetBatchesPerMonth: like(3),
  storedGenerationsPerWorkspace: like(100),
  workspaces: like(1),
};

export const entitlementsResponsePactBody = {
  limits: like(entitlementsLimitsPactBody),
  tier: like("free"),
  usage: like(entitlementsUsagePactBody),
};
