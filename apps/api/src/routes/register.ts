import type { Elysia } from "elysia";
import {
  handleCharacterAnchorDelete,
  handleCharacterAnchorPost,
} from "./anchor";
import {
  handleBillingCancelPost,
  handleBillingCheckoutPost,
  handleBillingMockCompletePost,
  handleBillingPortalPost,
  handleBillingSubscriptionGet,
} from "./billing";
import { handleEntitlementsGet } from "./entitlements";
import {
  handleGalleryDetail,
  handleGalleryLineage,
  handleGalleryList,
  handleGalleryReport,
  handleGallerySpecDiff,
} from "./gallery";
import { handleGenerationDelete } from "./generation-delete";
import {
  handleCharacterGenerations,
  handleCharactersDelete,
  handleCharactersList,
  handleCharactersPatch,
  handleCharactersPost,
  handleCharactersRemix,
  handleGenerationGet,
  handleGenerationReroll,
  handleGenerationsPost,
  handleKeysDelete,
  handleKeysList,
  handleKeysPost,
} from "./handlers";
import {
  handleOnboardingGet,
  handleOnboardingSeedDemoPost,
} from "./onboarding";
import { handleProviderCapabilities } from "./providers";
import { handleCharacterSheetPost, handleSheetBatchGet } from "./sheets";
import { handleSpecCatalog, handleSpecRender, handleThemesList } from "./spec";
import { handleStCardExport, handleStCardImport } from "./st-card";
import {
  handleTokensDelete,
  handleTokensList,
  handleTokensPost,
} from "./tokens";
import {
  handleWorkspacesActivate,
  handleWorkspacesDelete,
  handleWorkspacesList,
  handleWorkspacesPatch,
  handleWorkspacesPost,
} from "./workspaces";

type HttpMethod = "delete" | "get" | "patch" | "post";

export interface RouteMount {
  handler: (
    request: Request,
    params: Record<string, string>
  ) => Promise<Response>;
  method: HttpMethod;
  path: string;
}

export const LEGACY_ROUTE_PREFIX = "";
export const V1_ROUTE_PREFIX = "/v1";

export const SHARED_PROGRAMMATIC_ROUTES: RouteMount[] = [
  {
    handler: (request) => handleBillingCheckoutPost(request),
    method: "post",
    path: "/billing/checkout",
  },
  {
    handler: (request) => handleBillingPortalPost(request),
    method: "post",
    path: "/billing/portal",
  },
  {
    handler: (request) => handleBillingSubscriptionGet(request),
    method: "get",
    path: "/billing/subscription",
  },
  {
    handler: (request) => handleBillingCancelPost(request),
    method: "post",
    path: "/billing/cancel",
  },
  {
    handler: (request) => handleBillingMockCompletePost(request),
    method: "post",
    path: "/billing/mock/complete",
  },
  {
    handler: (request) => handleGenerationsPost(request),
    method: "post",
    path: "/generations",
  },
  {
    handler: (request, params) => handleGenerationGet(request, params.id ?? ""),
    method: "get",
    path: "/generations/:id",
  },
  {
    handler: (request, params) =>
      handleGenerationReroll(request, params.id ?? ""),
    method: "post",
    path: "/generations/:id/reroll",
  },
  {
    handler: (request, params) =>
      handleGenerationDelete(request, params.id ?? ""),
    method: "delete",
    path: "/generations/:id",
  },
  {
    handler: (request) => handleEntitlementsGet(request),
    method: "get",
    path: "/me/entitlements",
  },
  {
    handler: (request) => handleOnboardingGet(request),
    method: "get",
    path: "/me/onboarding",
  },
  {
    handler: (request) => handleOnboardingSeedDemoPost(request),
    method: "post",
    path: "/me/onboarding/seed-demo-character",
  },
  {
    handler: (request) => handleWorkspacesList(request),
    method: "get",
    path: "/workspaces",
  },
  {
    handler: (request) => handleWorkspacesPost(request),
    method: "post",
    path: "/workspaces",
  },
  {
    handler: (request, params) =>
      handleWorkspacesPatch(request, params.id ?? ""),
    method: "patch",
    path: "/workspaces/:id",
  },
  {
    handler: (request, params) =>
      handleWorkspacesDelete(request, params.id ?? ""),
    method: "delete",
    path: "/workspaces/:id",
  },
  {
    handler: (request, params) =>
      handleWorkspacesActivate(request, params.id ?? ""),
    method: "post",
    path: "/workspaces/:id/activate",
  },
  {
    handler: (request) => handleCharactersList(request),
    method: "get",
    path: "/characters",
  },
  {
    handler: (request) => handleCharactersPost(request),
    method: "post",
    path: "/characters",
  },
  {
    handler: (request, params) =>
      handleCharactersPatch(request, params.id ?? ""),
    method: "patch",
    path: "/characters/:id",
  },
  {
    handler: (request, params) =>
      handleCharactersDelete(request, params.id ?? ""),
    method: "delete",
    path: "/characters/:id",
  },
  {
    handler: (request, params) =>
      handleCharactersRemix(request, params.id ?? ""),
    method: "post",
    path: "/characters/:id/remix",
  },
  {
    handler: (request, params) =>
      handleCharacterGenerations(request, params.id ?? ""),
    method: "get",
    path: "/characters/:id/generations",
  },
  {
    handler: (request, params) =>
      handleCharacterAnchorPost(request, params.id ?? ""),
    method: "post",
    path: "/characters/:id/anchor",
  },
  {
    handler: (request, params) =>
      handleCharacterAnchorDelete(request, params.id ?? ""),
    method: "delete",
    path: "/characters/:id/anchor",
  },
  {
    handler: (request, params) =>
      handleCharacterSheetPost(request, params.id ?? ""),
    method: "post",
    path: "/characters/:id/sheet",
  },
  {
    handler: (request, params) => handleStCardExport(request, params.id ?? ""),
    method: "get",
    path: "/characters/:id/export/st-card",
  },
  {
    handler: (request, params) => handleSheetBatchGet(request, params.id ?? ""),
    method: "get",
    path: "/sheets/:id",
  },
  {
    handler: (request) => handleGalleryList(request),
    method: "get",
    path: "/gallery",
  },
  {
    handler: (request, params) =>
      handleGalleryLineage(request, params.id ?? ""),
    method: "get",
    path: "/gallery/:id/lineage",
  },
  {
    handler: (request, params) =>
      handleGallerySpecDiff(request, params.id ?? ""),
    method: "get",
    path: "/gallery/:id/spec-diff",
  },
  {
    handler: (request, params) => handleGalleryDetail(request, params.id ?? ""),
    method: "get",
    path: "/gallery/:id",
  },
  {
    handler: (request, params) => handleGalleryReport(request, params.id ?? ""),
    method: "post",
    path: "/gallery/:id/report",
  },
  {
    handler: (request) => handleKeysList(request),
    method: "get",
    path: "/keys",
  },
  {
    handler: (request) => handleKeysPost(request),
    method: "post",
    path: "/keys",
  },
  {
    handler: (request, params) => handleKeysDelete(request, params.id ?? ""),
    method: "delete",
    path: "/keys/:id",
  },
  {
    handler: (request) => handleTokensList(request),
    method: "get",
    path: "/tokens",
  },
  {
    handler: (request) => handleTokensPost(request),
    method: "post",
    path: "/tokens",
  },
  {
    handler: (request, params) => handleTokensDelete(request, params.id ?? ""),
    method: "delete",
    path: "/tokens/:id",
  },
];

export const V1_ONLY_ROUTES: RouteMount[] = [
  {
    handler: () => Promise.resolve(handleProviderCapabilities()),
    method: "get",
    path: "/providers/capabilities",
  },
  {
    handler: (request) => Promise.resolve(handleThemesList(request)),
    method: "get",
    path: "/themes",
  },
  {
    handler: (request) => Promise.resolve(handleSpecCatalog(request)),
    method: "get",
    path: "/spec/catalog",
  },
  {
    handler: (request) => handleSpecRender(request),
    method: "post",
    path: "/spec/render",
  },
  {
    handler: (request) => handleStCardImport(request),
    method: "post",
    path: "/spec/import/st-card",
  },
];

function mountRoute(
  app: Elysia,
  prefix: string,
  route: RouteMount,
  dispatch: (handler: () => Promise<Response>) => Promise<Response>,
  detail?: Record<string, unknown>
): Elysia {
  const fullPath = `${prefix}${route.path}`;
  const handler = ({
    request,
    params,
  }: {
    request: Request;
    params: Record<string, string>;
  }) => dispatch(() => route.handler(request, params));

  switch (route.method) {
    case "get":
      return app.get(fullPath, handler, detail ? { detail } : undefined);
    case "post":
      return app.post(fullPath, handler, detail ? { detail } : undefined);
    case "patch":
      return app.patch(fullPath, handler, detail ? { detail } : undefined);
    case "delete":
      return app.delete(fullPath, handler, detail ? { detail } : undefined);
    default:
      return app;
  }
}

export function mountProgrammaticRoutes(
  app: Elysia,
  prefix: string,
  dispatch: (handler: () => Promise<Response>) => Promise<Response>,
  options?: {
    includeOpenApiDetail?: boolean;
    includeV1OnlyRoutes?: boolean;
    openApiPathPrefix?: string;
  }
): Elysia {
  let next = app;
  for (const route of SHARED_PROGRAMMATIC_ROUTES) {
    next = mountRoute(
      next,
      prefix,
      route,
      dispatch,
      options?.includeOpenApiDetail
        ? openApiDetailForRoute(options.openApiPathPrefix ?? prefix, route)
        : undefined
    );
  }

  if (options?.includeV1OnlyRoutes) {
    for (const route of V1_ONLY_ROUTES) {
      next = mountRoute(
        next,
        prefix,
        route,
        dispatch,
        options.includeOpenApiDetail
          ? openApiDetailForRoute(options.openApiPathPrefix ?? prefix, route)
          : undefined
      );
    }
  }

  return next;
}

function openApiDetailForRoute(
  prefix: string,
  route: RouteMount
): Record<string, unknown> {
  const fullPath = `/api${prefix}${route.path}`;
  const sessionOnly =
    route.path.startsWith("/tokens") ||
    route.path.includes("/tokens/") ||
    route.path.startsWith("/workspaces") ||
    route.path.startsWith("/me/") ||
    route.path.startsWith("/billing");
  const optionalAuth = route.path.startsWith("/gallery");
  let authDescription =
    "Bearer token (`Authorization: Bearer ct_live_...`) or session cookie.";
  if (sessionOnly) {
    authDescription =
      "Session cookie required (token management is not available via bearer tokens).";
  } else if (optionalAuth) {
    authDescription =
      "Public read; bearer token or session cookie unlocks owner-only fields.";
  }

  return {
    description: authDescription,
    summary: `${route.method.toUpperCase()} ${fullPath}`,
    tags: [routeTag(route.path)],
    ...openApiErrorResponsesForRoute(route),
  };
}

function openApiErrorResponsesForRoute(
  route: RouteMount
): Record<string, unknown> {
  const documentsMutationErrors =
    route.method === "post" &&
    (route.path === "/generations" || route.path === "/characters");
  if (!documentsMutationErrors) {
    return {};
  }

  const apiError = {
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ApiError" },
      },
    },
  };

  return {
    responses: {
      400: {
        ...apiError,
        description: "Validation error (`validation_error`).",
      },
      401: {
        ...apiError,
        description: "Missing or invalid bearer token or session cookie.",
      },
      402: {
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/TierLimitError" },
          },
        },
        description: "Plan limit reached (`tier_limit`).",
      },
    },
  };
}

function routeTag(path: string): string {
  if (path.startsWith("/generations")) {
    return "generations";
  }
  if (path.startsWith("/characters")) {
    return "characters";
  }
  if (path.startsWith("/sheets")) {
    return "sheets";
  }
  if (path.startsWith("/gallery")) {
    return "gallery";
  }
  if (path.startsWith("/keys")) {
    return "keys";
  }
  if (path.startsWith("/tokens")) {
    return "tokens";
  }
  if (path.startsWith("/me/")) {
    return "me";
  }
  if (path.startsWith("/billing")) {
    return "billing";
  }
  if (path.startsWith("/workspaces")) {
    return "workspaces";
  }
  if (path.startsWith("/themes")) {
    return "spec";
  }
  if (path.startsWith("/spec/")) {
    return "spec";
  }
  if (path.startsWith("/providers")) {
    return "providers";
  }
  return "api";
}

export function listMountedPaths(prefix: string): string[] {
  const shared = SHARED_PROGRAMMATIC_ROUTES.map(
    (route) => `${route.method.toUpperCase()} ${prefix}${route.path}`
  );
  if (prefix !== V1_ROUTE_PREFIX) {
    return shared;
  }
  return [
    ...shared,
    ...V1_ONLY_ROUTES.map(
      (route) => `${route.method.toUpperCase()} ${prefix}${route.path}`
    ),
  ];
}
