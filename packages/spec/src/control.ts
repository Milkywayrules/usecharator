/** Control-mode resolution — ports acs_lib._effective_mode and _should_include_field. */

import { FINE_PATHS } from "./data/paths";
import type { CharacterSpec } from "./schema";
import { getPath, isEmpty } from "./utils";

export function effectiveMode(spec: CharacterSpec, section: string): string {
	const globalMode =
		getPath(spec as Record<string, unknown>, "control.mode") ?? "balanced";
	const sectionModes = getPath(
		spec as Record<string, unknown>,
		"control.section_modes",
	);
	if (
		typeof sectionModes === "object" &&
		sectionModes !== null &&
		!Array.isArray(sectionModes)
	) {
		const override = (sectionModes as Record<string, unknown>)[section];
		if (!isEmpty(override) && override !== "inherit") {
			return String(override);
		}
	}
	return String(globalMode);
}

export function shouldIncludeField(
	dotPath: string,
	value: unknown,
	mode: string,
): boolean {
	if (isEmpty(value)) {
		return false;
	}
	if (dotPath === "appearance.eyes.heterochromia" && value === false) {
		return false;
	}
	if (
		dotPath.endsWith(".facial_hair") &&
		String(value).toLowerCase() === "none"
	) {
		return false;
	}
	if (mode === "strict" && FINE_PATHS.has(dotPath)) {
		return false;
	}
	return true;
}
