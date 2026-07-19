/** Dot-path helpers and value formatting for spec engine. */

export function getPath(
	data: Record<string, unknown>,
	dotPath: string,
): unknown {
	let cur: unknown = data;
	for (const part of dotPath.split(".")) {
		if (typeof cur !== "object" || cur === null || !(part in cur)) {
			return;
		}
		cur = (cur as Record<string, unknown>)[part];
	}
	return cur;
}

export function setPath(
	data: Record<string, unknown>,
	dotPath: string,
	value: unknown,
): void {
	const parts = dotPath.split(".");
	let cur: Record<string, unknown> = data;
	for (const part of parts.slice(0, -1)) {
		const next = cur[part];
		if (typeof next !== "object" || next === null || Array.isArray(next)) {
			cur[part] = {};
		}
		cur = cur[part] as Record<string, unknown>;
	}
	const last = parts.at(-1);
	if (last !== undefined) {
		cur[last] = value;
	}
}

export function isEmpty(value: unknown): boolean {
	if (value === null || value === undefined) {
		return true;
	}
	if (typeof value === "string") {
		return value.trim() === "";
	}
	if (Array.isArray(value)) {
		return value.length === 0;
	}
	if (typeof value === "object") {
		return Object.keys(value).length === 0;
	}
	if (typeof value === "boolean") {
		return false;
	}
	return false;
}

export function formatValue(value: unknown): string {
	if (typeof value === "boolean") {
		return value ? "yes" : "no";
	}
	return String(value);
}

export function humanize(key: string): string {
	return key.replace(/_/g, " ");
}
