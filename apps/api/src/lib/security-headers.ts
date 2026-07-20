import { Elysia } from "elysia";

const DOCS_PATH_PREFIX = "/api/v1/docs";

function isTlsRequest(request: Request): boolean {
  if (new URL(request.url).protocol === "https:") {
    return true;
  }
  const forwardedProto = request.headers.get("x-forwarded-proto");
  return forwardedProto?.split(",")[0]?.trim() === "https";
}

function isDocsPath(pathname: string): boolean {
  return (
    pathname === DOCS_PATH_PREFIX || pathname.startsWith(`${DOCS_PATH_PREFIX}/`)
  );
}

/** Security headers for JSON API responses; no CSP (Scalar docs load third-party assets). */
export function securityHeaders() {
  return new Elysia({ name: "security-headers" })
    .onAfterHandle({ as: "global" }, ({ request, set }) => {
      const headers = set.headers ?? {};
      headers["X-Content-Type-Options"] = "nosniff";
      headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
      headers["X-Frame-Options"] = "DENY";

      if (isTlsRequest(request)) {
        headers["Strict-Transport-Security"] =
          "max-age=31536000; includeSubDomains";
      }

      set.headers = headers;
    })
    .onAfterHandle({ as: "global" }, ({ request, set }) => {
      const { pathname } = new URL(request.url);
      if (!isDocsPath(pathname)) {
        return;
      }
      const headers = set.headers ?? {};
      headers["X-Robots-Tag"] = "noindex";
      set.headers = headers;
    });
}

export { DOCS_PATH_PREFIX, isDocsPath, isTlsRequest };
