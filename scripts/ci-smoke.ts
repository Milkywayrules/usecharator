/**
 * API + Postgres smoke checks for CI and local integration runs.
 *
 * Requires a running API (`API_URL`, default http://127.0.0.1:3001) and
 * `DATABASE_URL` to seed a public gallery character via Drizzle.
 */

const { API_URL: apiUrlEnv, CI, DATABASE_URL } = process.env;
const API_URL = (apiUrlEnv ?? "http://127.0.0.1:3001").replace(/\/$/, "");
const CI_SMOKE_USER_ID = "ci-smoke-user";
const CI_SMOKE_WORKSPACE_ID = `ws_${CI_SMOKE_USER_ID}`;
const CI_SMOKE_MEMBER_ID = `mbr_${CI_SMOKE_USER_ID}`;
const CI_SMOKE_CHARACTER_ID = "00000000-0000-4000-8000-000000000001";
const CI_SMOKE_REMIX_CHARACTER_ID = "00000000-0000-4000-8000-000000000002";

interface GalleryListResponse {
  items: { id: string; name: string }[];
}

interface GalleryLineageResponse {
  children: { items: { id: string }[]; total: number };
  parent: { id: string } | { unavailable: true } | null;
}

interface GallerySpecDiffResponse {
  sections: { sectionKey: string; changes: { path: string }[] }[];
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

  const { characters, createDb, member, organization, user } = await import(
    "@charator/db"
  );
  const { createEmptySpec } = await import("@charator/spec");
  const { client, db } = createDb(DATABASE_URL);
  const now = new Date();
  const parentSpec = createEmptySpec();
  parentSpec.meta.id = "ci-smoke";
  parentSpec.meta.name = "CI Smoke Character";
  parentSpec.identity.gender = "female";

  const remixSpec = createEmptySpec();
  remixSpec.meta.id = "ci-smoke-remix";
  remixSpec.meta.name = "CI Smoke Remix";
  remixSpec.identity.gender = "male";

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
      .insert(organization)
      .values({
        createdAt: now,
        id: CI_SMOKE_WORKSPACE_ID,
        name: "CI Smoke Workspace",
        slug: "ci-smoke",
      })
      .onConflictDoNothing();

    await db
      .insert(member)
      .values({
        createdAt: now,
        id: CI_SMOKE_MEMBER_ID,
        organizationId: CI_SMOKE_WORKSPACE_ID,
        role: "owner",
        userId: CI_SMOKE_USER_ID,
      })
      .onConflictDoNothing();

    await db
      .insert(characters)
      .values({
        id: CI_SMOKE_CHARACTER_ID,
        moderationStatus: "visible",
        name: "CI Smoke Character",
        ownerUserId: CI_SMOKE_USER_ID,
        spec: parentSpec,
        themeId: "anime",
        visibility: "public",
        workspaceId: CI_SMOKE_WORKSPACE_ID,
      })
      .onConflictDoNothing();

    await db
      .insert(characters)
      .values({
        id: CI_SMOKE_REMIX_CHARACTER_ID,
        moderationStatus: "visible",
        name: "CI Smoke Remix",
        ownerUserId: CI_SMOKE_USER_ID,
        remixedFromCharacterId: CI_SMOKE_CHARACTER_ID,
        spec: remixSpec,
        themeId: "anime",
        visibility: "public",
        workspaceId: CI_SMOKE_WORKSPACE_ID,
      })
      .onConflictDoNothing();
  } finally {
    await client.end();
  }

  console.log(
    `OK seeded gallery fixture (${CI_SMOKE_CHARACTER_ID}, remix ${CI_SMOKE_REMIX_CHARACTER_ID})`
  );
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

  const lineage = await fetchJson<GalleryLineageResponse>(
    `/api/gallery/${characterId}/lineage`,
    "GET /api/gallery/:id/lineage"
  );
  const lineageHasRemix = lineage.children.items.some(
    (item) => item.id === CI_SMOKE_REMIX_CHARACTER_ID
  );
  if (!lineageHasRemix) {
    console.error(
      `FAIL GET /api/gallery/:id/lineage: expected remix child ${CI_SMOKE_REMIX_CHARACTER_ID}`
    );
    process.exit(1);
  }
  console.log("OK GET /api/gallery/:id/lineage lists public remix child");

  const mostRemixed = await fetchJson<GalleryListResponse>(
    "/api/gallery?sort=most_remixed",
    "GET /api/gallery?sort=most_remixed"
  );
  if (mostRemixed.items[0]?.id !== characterId) {
    console.error(
      `FAIL GET /api/gallery?sort=most_remixed: expected parent ${characterId} first, got ${mostRemixed.items[0]?.id ?? "none"}`
    );
    process.exit(1);
  }
  console.log("OK GET /api/gallery?sort=most_remixed ranks parent first");

  const specDiff = await fetchJson<GallerySpecDiffResponse>(
    `/api/gallery/${CI_SMOKE_REMIX_CHARACTER_ID}/spec-diff?other=${characterId}`,
    "GET /api/gallery/:id/spec-diff"
  );
  const identitySection = specDiff.sections.find(
    (section) => section.sectionKey === "identity"
  );
  const genderChange = identitySection?.changes.find(
    (change) => change.path === "identity.gender"
  );
  if (!genderChange) {
    console.error(
      "FAIL GET /api/gallery/:id/spec-diff: expected identity.gender change"
    );
    process.exit(1);
  }
  console.log("OK GET /api/gallery/:id/spec-diff returns changed section");

  const importCard = {
    data: {
      description: "CI smoke import",
      name: "CI Smoke ST Card",
      tags: ["ci"],
    },
    spec: "chara_card_v3",
    spec_version: "3.0",
  };
  const importResponse = await fetch(`${API_URL}/api/v1/spec/import/st-card`, {
    body: JSON.stringify(importCard),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!importResponse.ok) {
    const body = await importResponse.text().catch(() => "");
    console.error(
      `FAIL POST /api/v1/spec/import/st-card: ${importResponse.status}${body ? `\n${body}` : ""}`
    );
    process.exit(1);
  }
  const imported = (await importResponse.json()) as {
    reviewRequired?: boolean;
    sourceFormat?: string;
  };
  if (
    imported.sourceFormat !== "ccv3-json" ||
    imported.reviewRequired !== true
  ) {
    console.error(
      `FAIL POST /api/v1/spec/import/st-card: unexpected body ${JSON.stringify(imported)}`
    );
    process.exit(1);
  }
  console.log("OK POST /api/v1/spec/import/st-card");

  await runBillingSmoke();

  console.log("ci smoke passed");
}

async function runBillingSmoke(): Promise<void> {
  const { createDb, subscriptions, user } = await import("@charator/db");
  const { MockPaymentProvider, applyBillingWebhookEvent, signWebhookPayload } =
    await import("@charator/payments");
  const { eq } = await import("drizzle-orm");
  const { client, db } = createDb(DATABASE_URL!);
  const webhookSecret =
    process.env.PAYMENT_WEBHOOK_SECRET ?? "ci-test-payment-webhook-secret";
  const provider = new MockPaymentProvider(db, {
    paymentProvider: "mock",
    paymentWebhookSecret: webhookSecret,
    webAppUrl: process.env.WEB_APP_URL ?? "http://127.0.0.1:3000",
  });

  try {
    await db
      .update(user)
      .set({ tier: "free" })
      .where(eq(user.id, CI_SMOKE_USER_ID));

    await db
      .delete(subscriptions)
      .where(eq(subscriptions.userId, CI_SMOKE_USER_ID));

    const checkout = await provider.createCheckoutSession({
      cancelUrl: "http://127.0.0.1:3000/pricing",
      successUrl: "http://127.0.0.1:3000/settings#plan",
      tier: "plus",
      userId: CI_SMOKE_USER_ID,
    });
    console.log("OK mock checkout session created");

    const { rawBody, signature } = await provider.completeCheckoutSession(
      checkout.id
    );
    const verified = provider.verifyWebhook(rawBody, signature);
    await applyBillingWebhookEvent(db, verified);
    console.log("OK mock checkout completed via webhook path");

    const subscription = await provider.getSubscription(CI_SMOKE_USER_ID);
    const [userRow] = await db
      .select({ tier: user.tier })
      .from(user)
      .where(eq(user.id, CI_SMOKE_USER_ID))
      .limit(1);

    if (subscription?.status !== "active" || userRow?.tier !== "plus") {
      console.error(
        `FAIL billing activation: subscription=${JSON.stringify(subscription)} tier=${userRow?.tier}`
      );
      process.exit(1);
    }
    console.log("OK subscription active and user tier is plus");

    const cancelEvent = await provider.cancelSubscription(CI_SMOKE_USER_ID, {
      atPeriodEnd: true,
    });
    await applyBillingWebhookEvent(db, cancelEvent);

    const [afterCancel] = await db
      .select({ tier: user.tier })
      .from(user)
      .where(eq(user.id, CI_SMOKE_USER_ID))
      .limit(1);
    if (afterCancel?.tier !== "free") {
      console.error(
        `FAIL billing cancel: expected free tier, got ${afterCancel?.tier}`
      );
      process.exit(1);
    }
    console.log("OK billing loop canceled back to free");

    const tamperedPayload = JSON.stringify({
      data: { tier: "studio", userId: CI_SMOKE_USER_ID },
      id: "evt_tampered",
      type: "checkout.completed",
    });
    const webhookReject = await fetch(`${API_URL}/api/billing/webhook`, {
      body: tamperedPayload,
      headers: {
        "Content-Type": "application/json",
        "Payment-Signature": "t=1,v1=deadbeef",
      },
      method: "POST",
    });
    if (webhookReject.status !== 400) {
      console.error(
        `FAIL POST /api/billing/webhook bad signature: expected 400, got ${webhookReject.status}`
      );
      process.exit(1);
    }
    console.log("OK POST /api/billing/webhook rejects bad signature");

    const goodPayload = JSON.stringify({
      data: {
        currentPeriodEnd: new Date(Date.now() + 86_400_000).toISOString(),
        subscriptionId: "sub_ci_smoke_webhook",
        tier: "pro",
        userId: CI_SMOKE_USER_ID,
      },
      id: "evt_ci_smoke",
      type: "checkout.completed",
    });
    const webhookOk = await fetch(`${API_URL}/api/billing/webhook`, {
      body: goodPayload,
      headers: {
        "Content-Type": "application/json",
        "Payment-Signature": signWebhookPayload(webhookSecret, goodPayload),
      },
      method: "POST",
    });
    if (!webhookOk.ok) {
      const body = await webhookOk.text().catch(() => "");
      console.error(
        `FAIL POST /api/billing/webhook: ${webhookOk.status}${body ? `\n${body}` : ""}`
      );
      process.exit(1);
    }
    console.log("OK POST /api/billing/webhook verified event");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
