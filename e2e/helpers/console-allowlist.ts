/**
 * Console messages allowed during e2e (degraded API without Postgres).
 * Keep tight — document each pattern when adding.
 */
export const CONSOLE_ERROR_ALLOWLIST: RegExp[] = [
  // db-backed routes without Postgres or valid session cookies
  /Failed to load resource.*\/api\/(characters|gallery|provider-keys|api-tokens|telegram|keys|me|workspaces)/,
  /Failed to load resource.*\/api\/v1\/(characters|gallery|providers)/,
  /Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/,
  /Failed to load resource: the server responded with a status of 500 \(Internal Server Error\)/,
  // better-auth session probe when DB is unavailable
  /Failed to load resource.*\/api\/auth\//,
  // next-themes / client-only counts — hydration mismatch on first paint
  /Minified React error #418/,
];

export function isAllowedConsoleError(text: string): boolean {
  return CONSOLE_ERROR_ALLOWLIST.some((pattern) => pattern.test(text));
}
