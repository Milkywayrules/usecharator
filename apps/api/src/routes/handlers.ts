import { characters, generationJobs, providerKeys } from "@charator/db";
import {
	createCharacterRequestSchema,
	createGenerationRequestSchema,
	createProviderKeyRequestSchema,
	updateCharacterRequestSchema,
} from "@charator/shared";
import { and, eq } from "drizzle-orm";
import { auth, db, getSessionUser, requireSessionUser } from "../auth";
import { config } from "../config";
import {
	completeJobFromUrls,
	defaultModelFor,
	failTimedOutJobs,
	markJobFailed,
	pollStaleRunningJobs,
	processGenerationJob,
	rememberJobCredentials,
	resolveApiKey,
	signedUrlsForJob,
} from "../jobs/processor";
import { decryptSecret, encryptSecret, maskApiKey } from "../lib/crypto";
import { HttpError } from "../lib/errors";
import {
	clientIpFromHeaders,
	SlidingWindowRateLimiter,
} from "../lib/rate-limit";
import { getProviderAdapter } from "../providers/registry";

const anonymousLimiter = new SlidingWindowRateLimiter(
	config.RATE_LIMIT_ANONYMOUS_PER_HOUR,
	60 * 60 * 1000,
);
const authenticatedLimiter = new SlidingWindowRateLimiter(
	config.RATE_LIMIT_AUTHENTICATED_PER_HOUR,
	60 * 60 * 1000,
);

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status });
}

async function readJson<T>(request: Request): Promise<T> {
	return (await request.json()) as T;
}

export async function handleGenerationsPost(
	request: Request,
): Promise<Response> {
	const sessionUser = await getSessionUser(request);
	const parsed = createGenerationRequestSchema.safeParse(
		await readJson(request),
	);
	if (!parsed.success) {
		throw new HttpError(400, {
			code: "validation_error",
			message: parsed.error.issues[0]?.message ?? "invalid request",
		});
	}

	const ip = clientIpFromHeaders(request.headers);
	const limiter = sessionUser ? authenticatedLimiter : anonymousLimiter;
	const limitKey = sessionUser ? `user:${sessionUser.id}` : `ip:${ip}`;
	const limit = limiter.consume(limitKey);
	if (!limit.allowed) {
		throw new HttpError(429, {
			code: "rate_limited",
			message: "too many generation requests",
		});
	}

	if (parsed.data.providerKeyId && !sessionUser) {
		throw new HttpError(401, {
			code: "unauthorized",
			message: "sign in required to use saved provider keys",
		});
	}

	let credentials: { apiKey: string; baseUrl?: string; providerKeyId?: string };
	try {
		credentials = await resolveApiKey(db, parsed.data, sessionUser?.id ?? null);
	} catch {
		throw new HttpError(400, {
			code: "invalid_key",
			message: "provider key could not be resolved",
		});
	}

	const model = defaultModelFor(parsed.data.provider, parsed.data.model);

	const [job] = await db
		.insert(generationJobs)
		.values({
			characterId: parsed.data.characterId ?? null,
			model,
			negativePrompt: parsed.data.negativePrompt ?? null,
			prompt: parsed.data.prompt,
			provider: parsed.data.provider,
			specSnapshot: parsed.data.specSnapshot ?? null,
			status: "queued",
			userId: sessionUser?.id ?? null,
		})
		.returning();

	if (!job) {
		throw new HttpError(500, {
			code: "internal_error",
			message: "failed to create job",
		});
	}

	rememberJobCredentials(job.id, credentials, sessionUser?.id ?? null);
	void processGenerationJob(db, job.id, credentials);

	return json({ jobId: job.id }, 202);
}

export async function handleGenerationGet(
	request: Request,
	jobId: string,
): Promise<Response> {
	const [job] = await db
		.select()
		.from(generationJobs)
		.where(eq(generationJobs.id, jobId))
		.limit(1);

	if (!job) {
		throw new HttpError(404, { code: "not_found", message: "job not found" });
	}

	const sessionUser = await getSessionUser(request);
	if (job.userId && job.userId !== sessionUser?.id) {
		throw new HttpError(403, {
			code: "forbidden",
			message: "job not accessible",
		});
	}

	return json({
		createdAt: job.createdAt.toISOString(),
		error: job.error,
		finishedAt: job.finishedAt?.toISOString() ?? null,
		id: job.id,
		imageUrls:
			job.status === "succeeded" ? signedUrlsForJob(job.imageKeys) : undefined,
		model: job.model,
		provider: job.provider,
		startedAt: job.startedAt?.toISOString() ?? null,
		status: job.status,
	});
}

export async function handleCharactersList(
	request: Request,
): Promise<Response> {
	const user = await requireSessionUser(request);
	const rows = await db
		.select()
		.from(characters)
		.where(eq(characters.ownerUserId, user.id));

	return json(
		rows.map((row) => ({
			createdAt: row.createdAt.toISOString(),
			id: row.id,
			name: row.name,
			spec: row.spec,
			updatedAt: row.updatedAt.toISOString(),
			visibility: row.visibility,
		})),
	);
}

export async function handleCharactersPost(
	request: Request,
): Promise<Response> {
	const user = await requireSessionUser(request);
	const parsed = createCharacterRequestSchema.safeParse(
		await readJson(request),
	);
	if (!parsed.success) {
		throw new HttpError(400, {
			code: "validation_error",
			message: parsed.error.issues[0]?.message ?? "invalid request",
		});
	}

	const [row] = await db
		.insert(characters)
		.values({
			name: parsed.data.name,
			ownerUserId: user.id,
			spec: parsed.data.spec,
			visibility: parsed.data.visibility,
		})
		.returning();

	return json(
		{
			createdAt: row?.createdAt.toISOString(),
			id: row?.id,
			name: row?.name,
			spec: row?.spec,
			updatedAt: row?.updatedAt.toISOString(),
			visibility: row?.visibility,
		},
		201,
	);
}

export async function handleCharactersPatch(
	request: Request,
	characterId: string,
): Promise<Response> {
	const user = await requireSessionUser(request);
	const parsed = updateCharacterRequestSchema.safeParse(
		await readJson(request),
	);
	if (!parsed.success) {
		throw new HttpError(400, {
			code: "validation_error",
			message: parsed.error.issues[0]?.message ?? "invalid request",
		});
	}

	const [existing] = await db
		.select()
		.from(characters)
		.where(
			and(eq(characters.id, characterId), eq(characters.ownerUserId, user.id)),
		)
		.limit(1);

	if (!existing) {
		throw new HttpError(404, {
			code: "not_found",
			message: "character not found",
		});
	}

	const [row] = await db
		.update(characters)
		.set({
			...(parsed.data.name === undefined ? {} : { name: parsed.data.name }),
			...(parsed.data.spec === undefined ? {} : { spec: parsed.data.spec }),
			...(parsed.data.visibility === undefined
				? {}
				: { visibility: parsed.data.visibility }),
			updatedAt: new Date(),
		})
		.where(eq(characters.id, characterId))
		.returning();

	return json({
		createdAt: row?.createdAt.toISOString(),
		id: row?.id,
		name: row?.name,
		spec: row?.spec,
		updatedAt: row?.updatedAt.toISOString(),
		visibility: row?.visibility,
	});
}

export async function handleCharactersDelete(
	request: Request,
	characterId: string,
): Promise<Response> {
	const user = await requireSessionUser(request);
	const deleted = await db
		.delete(characters)
		.where(
			and(eq(characters.id, characterId), eq(characters.ownerUserId, user.id)),
		)
		.returning({ id: characters.id });

	if (deleted.length === 0) {
		throw new HttpError(404, {
			code: "not_found",
			message: "character not found",
		});
	}

	return new Response(null, { status: 204 });
}

export async function handleKeysList(request: Request): Promise<Response> {
	const user = await requireSessionUser(request);
	const rows = await db
		.select()
		.from(providerKeys)
		.where(eq(providerKeys.userId, user.id));

	return json(
		rows.map((row) => ({
			createdAt: row.createdAt.toISOString(),
			customBaseUrl: row.customBaseUrl,
			hint: maskApiKey(
				decryptSecret(row.encryptedKey, config.KEY_ENCRYPTION_MASTER_KEY),
			),
			id: row.id,
			label: row.label,
			provider: row.provider,
		})),
	);
}

export async function handleKeysPost(request: Request): Promise<Response> {
	const user = await requireSessionUser(request);
	const parsed = createProviderKeyRequestSchema.safeParse(
		await readJson(request),
	);
	if (!parsed.success) {
		throw new HttpError(400, {
			code: "validation_error",
			message: parsed.error.issues[0]?.message ?? "invalid request",
		});
	}

	if (parsed.data.provider === "custom" && !parsed.data.customBaseUrl) {
		throw new HttpError(400, {
			code: "validation_error",
			message: "custom provider requires customBaseUrl",
		});
	}

	const encryptedKey = encryptSecret(
		parsed.data.apiKey,
		config.KEY_ENCRYPTION_MASTER_KEY,
	);

	try {
		const [row] = await db
			.insert(providerKeys)
			.values({
				customBaseUrl: parsed.data.customBaseUrl ?? null,
				encryptedKey,
				label: parsed.data.label,
				provider: parsed.data.provider,
				userId: user.id,
			})
			.returning();

		return json(
			{
				createdAt: row?.createdAt.toISOString(),
				customBaseUrl: row?.customBaseUrl,
				hint: maskApiKey(parsed.data.apiKey),
				id: row?.id,
				label: row?.label,
				provider: row?.provider,
			},
			201,
		);
	} catch {
		throw new HttpError(409, {
			code: "conflict",
			message: "provider key label already exists for this provider",
		});
	}
}

export async function handleKeysDelete(
	request: Request,
	keyId: string,
): Promise<Response> {
	const user = await requireSessionUser(request);
	const deleted = await db
		.delete(providerKeys)
		.where(and(eq(providerKeys.id, keyId), eq(providerKeys.userId, user.id)))
		.returning({ id: providerKeys.id });

	if (deleted.length === 0) {
		throw new HttpError(404, {
			code: "not_found",
			message: "provider key not found",
		});
	}

	return new Response(null, { status: 204 });
}

export async function handleFalWebhook(request: Request): Promise<Response> {
	const body = await readJson<unknown>(request);
	const adapter = getProviderAdapter("fal");
	const parsed = adapter.parseWebhook?.(body, request.headers);
	if (!parsed) {
		return json({ ok: false }, 400);
	}

	const [job] = await db
		.select()
		.from(generationJobs)
		.where(eq(generationJobs.providerJobId, parsed.providerJobId))
		.limit(1);

	if (!job) {
		return json({ ok: true });
	}

	if (parsed.status === "failed") {
		await markJobFailed(db, job.id, parsed.error ?? "fal webhook failed");
		return json({ ok: true });
	}

	if (parsed.imageUrls?.length) {
		try {
			await completeJobFromUrls(db, job.id, parsed.imageUrls);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "webhook processing failed";
			await markJobFailed(db, job.id, message);
		}
	}

	return json({ ok: true });
}

export async function handleReplicateWebhook(
	request: Request,
): Promise<Response> {
	const body = await readJson<unknown>(request);
	const adapter = getProviderAdapter("replicate");
	const parsed = adapter.parseWebhook?.(body, request.headers);
	if (!parsed) {
		return json({ ok: false }, 400);
	}

	const [job] = await db
		.select()
		.from(generationJobs)
		.where(eq(generationJobs.providerJobId, parsed.providerJobId))
		.limit(1);

	if (!job) {
		return json({ ok: true });
	}

	if (parsed.status === "failed") {
		await markJobFailed(db, job.id, parsed.error ?? "replicate webhook failed");
		return json({ ok: true });
	}

	if (parsed.imageUrls?.length) {
		try {
			await completeJobFromUrls(db, job.id, parsed.imageUrls);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "webhook processing failed";
			await markJobFailed(db, job.id, message);
		}
	}

	return json({ ok: true });
}

export function startJobMaintenanceLoop(): void {
	setInterval(() => {
		void failTimedOutJobs(db);
		void pollStaleRunningJobs(db);
	}, config.GENERATION_POLL_INTERVAL_MS);
}

export { auth };
