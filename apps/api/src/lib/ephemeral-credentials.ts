interface EphemeralCredentials {
	apiKey: string;
	baseUrl?: string;
	providerKeyId?: string;
	userId?: string;
}

const store = new Map<string, EphemeralCredentials>();

export function setEphemeralCredentials(
	jobId: string,
	credentials: EphemeralCredentials,
): void {
	store.set(jobId, credentials);
}

export function getEphemeralCredentials(
	jobId: string,
): EphemeralCredentials | undefined {
	return store.get(jobId);
}

export function clearEphemeralCredentials(jobId: string): void {
	store.delete(jobId);
}

/** Test helper — not for production callers. */
export function clearAllEphemeralCredentials(): void {
	store.clear();
}

export type { EphemeralCredentials };
