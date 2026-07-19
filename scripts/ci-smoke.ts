/**
 * API + Postgres smoke checks for CI and local integration runs.
 *
 * Requires a running API (`API_URL`, default http://127.0.0.1:3001) and
 * `DATABASE_URL` to seed a public gallery character via Drizzle.
 */

const { API_URL: apiUrlEnv, CI, DATABASE_URL } = process.env;
const API_URL = (apiUrlEnv ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const CI_SMOKE_USER_ID = "ci-smoke-user";
const CI_SMOKE_CHARACTER_ID = "00000000-0000-4000-8000-000000000001";

interface GalleryListResponse {
  items: { id: string; name: string }[];
}

async function fetchJson<T>(path: string, label: string): Promise<T> {
  const url = `${API_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    console.error(`FAIL ${label}: fetch error for ${url}`, error);
    process.exit(1);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(
      `FAIL ${label}: ${response.status} ${url}${body ? `\n${body}` : ""}`
    );
    process.exit(1);
  }

  console.log(`OK ${label}`);
  return (await response.json()) as T;
}

async function seedGalleryFixture(): Promise<string> {
  if (!DATABASE_URL) {
    console.error("DATABASE_URL is required to seed gallery data");
    process.exit(1);
  }

  const { characters, createDb, user } = await import("@charator/db");
  const { client, db } = createDb(DATABASE_URL);

  try {
    await db
      .insert(user)
      .values({
        email: "ci-smoke@example.com",
        emailVerified: false,
        id: CI_SMOKE_USER_ID,
        name: "CI Smoke",
      })
      .onConflictDoNothing();

    await db
      .insert(characters)
      .values({
        id: CI_SMOKE_CHARACTER_ID,
        moderationStatus: "visible",
        name: "CI Smoke Character",
        ownerUserId: CI_SMOKE_USER_ID,
        spec: {
          meta: { id: "ci-smoke", name: "CI Smoke Character" },
          spec_version: 2,
        },
        themeId: "anime",
        visibility: "public",
      })
      .onConflictDoNothing();
  } finally {
    await client.end();
  }

  console.log(`OK seeded gallery fixture (${CI_SMOKE_CHARACTER_ID})`);
  return CI_SMOKE_CHARACTER_ID;
}

async function main(): Promise<void> {
  const health = await fetchJson<{ status: string }>(
    "/api/health",
    "GET /api/health"
  );
  if (health.status !== "ok") {
    console.error(
      `FAIL GET /api/health: unexpected body ${JSON.stringify(health)}`
    );
    process.exit(1);
  }

  const listBefore = await fetchJson<GalleryListResponse>(
    "/api/gallery",
    "GET /api/gallery (before seed)"
  );
  if (!Array.isArray(listBefore.items)) {
    console.error("FAIL GET /api/gallery: response missing items array");
    process.exit(1);
  }
  if (CI === "true" && listBefore.items.length > 0) {
    console.error(
      `FAIL GET /api/gallery: expected empty list on fresh CI database, got ${listBefore.items.length} item(s)`
    );
    process.exit(1);
  }

  const characterId = await seedGalleryFixture();

  const listAfter = await fetchJson<GalleryListResponse>(
    "/api/gallery",
    "GET /api/gallery (after seed)"
  );
  const listed = listAfter.items.some((item) => item.id === characterId);
  if (!listed) {
    console.error(
      `FAIL GET /api/gallery: seeded character ${characterId} not returned`
    );
    process.exit(1);
  }
  console.log("OK GET /api/gallery lists seeded character");

  const searchMatch = await fetchJson<GalleryListResponse>(
    `/api/gallery?q=${encodeURIComponent("CI Smoke")}`,
    "GET /api/gallery?q=CI Smoke"
  );
  const foundBySearch = searchMatch.items.some(
    (item) => item.id === characterId
  );
  if (!foundBySearch) {
    console.error(
      `FAIL GET /api/gallery?q=CI Smoke: seeded character ${characterId} not returned`
    );
    process.exit(1);
  }
  console.log("OK GET /api/gallery search returns seeded character");

  const searchMiss = await fetchJson<GalleryListResponse>(
    "/api/gallery?q=zzzz-no-match-zzzz",
    "GET /api/gallery?q=zzzz-no-match-zzzz"
  );
  if (searchMiss.items.some((item) => item.id === characterId)) {
    console.error(
      "FAIL GET /api/gallery?q=zzzz-no-match-zzzz: should not return seeded character"
    );
    process.exit(1);
  }
  console.log("OK GET /api/gallery search excludes non-matching query");

  const detail = await fetchJson<{ id: string; name: string }>(
    `/api/gallery/${characterId}`,
    "GET /api/gallery/:id"
  );
  if (detail.id !== characterId) {
    console.error(
      `FAIL GET /api/gallery/:id: expected id ${characterId}, got ${detail.id}`
    );
    process.exit(1);
  }

  console.log("ci smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
