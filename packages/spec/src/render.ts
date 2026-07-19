/** Deterministic prompt renderer — port of acs_lib.render_prompt. */

import { effectiveMode, shouldIncludeField } from "./control";
import { FIELD_ORDER } from "./data/field-order";
import { SECTION_TITLES } from "./data/paths";
import type { CharacterSpec } from "./schema";
import { formatValue, getPath, humanize, isEmpty } from "./utils";

const RENDER_SECTIONS = [
	"identity",
	"personality",
	"archetype",
	"appearance",
	"outfit",
	"magic",
	"pose",
	"framing",
	"setting",
	"props",
	"art",
] as const;

function walkSection(
	section: Record<string, unknown>,
	prefix: string,
	lines: string[],
	dotPrefix: string,
	mode: string,
): void {
	const orderedKeys = FIELD_ORDER[dotPrefix];
	const entries = orderedKeys
		? orderedKeys
				.filter((key) => key in section)
				.map((key) => [key, section[key]] as const)
		: Object.entries(section);

	for (const [key, value] of entries) {
		const path = dotPrefix ? `${dotPrefix}.${key}` : key;
		if (!shouldIncludeField(path, value, mode)) {
			continue;
		}
		const label = prefix ? `${prefix}${humanize(key)}` : humanize(key);
		if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			walkSection(
				value as Record<string, unknown>,
				`${label} — `,
				lines,
				path,
				mode,
			);
		} else if (Array.isArray(value)) {
			const items = value.filter((v) => !isEmpty(v)).map((v) => formatValue(v));
			if (items.length > 0) {
				lines.push(`${label}: ${items.join(", ")}`);
			}
		} else {
			lines.push(`${label}: ${formatValue(value)}`);
		}
	}
}

/** Render a character spec to a single-line image prompt (Python parity). */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: direct port of acs_lib.render_prompt for byte parity
export function renderPromptBase(spec: CharacterSpec): string {
	const mode =
		getPath(spec as Record<string, unknown>, "control.mode") ?? "balanced";
	const meta = (spec.meta ?? {}) as Record<string, unknown>;
	const art = (spec.art ?? {}) as Record<string, unknown>;
	const gen = (spec.generation ?? {}) as Record<string, unknown>;
	const framing = (spec.framing ?? {}) as Record<string, unknown>;
	const locked = getPath(spec as Record<string, unknown>, "control.locked");

	const lines: string[] = [];
	const name = meta.name || meta.id || "character";
	lines.push(`Modern anime illustration of ${name}.`);

	if (mode === "strict") {
		lines.push(
			"Use ONLY the specified details below; do not invent unstated features.",
		);
	} else if (mode === "expressive") {
		lines.push(
			"Anchor on specified details; interpret missing sections creatively within anime style.",
		);
	} else {
		lines.push(
			"Honor all specified details; subtle fine-detail inference allowed where not specified.",
		);
	}

	if (!isEmpty(meta.notes)) {
		lines.push(`Concept: ${meta.notes}.`);
	}
	if (!isEmpty(meta.inspiration)) {
		lines.push(`Inspiration mood: ${meta.inspiration}.`);
	}

	const detailLines: string[] = [];
	for (const sectionKey of RENDER_SECTIONS) {
		const block = spec[sectionKey];
		if (typeof block !== "object" || block === null || Array.isArray(block)) {
			continue;
		}
		const title = SECTION_TITLES[sectionKey as keyof typeof SECTION_TITLES];
		const sectionMode = effectiveMode(spec, sectionKey);
		const buf: string[] = [];
		walkSection(
			block as Record<string, unknown>,
			"",
			buf,
			sectionKey,
			sectionMode,
		);
		if (buf.length > 0) {
			detailLines.push(`${title}: ${buf.join("; ")}`);
		}
	}
	lines.push(...detailLines);

	const freeform = getPath(spec as Record<string, unknown>, "control.freeform");
	if (
		mode === "expressive" ||
		effectiveMode(spec, "appearance") === "expressive"
	) {
		for (const key of ["overall", "appearance", "outfit", "setting"] as const) {
			const text =
				typeof freeform === "object" &&
				freeform !== null &&
				!Array.isArray(freeform)
					? (freeform as Record<string, unknown>)[key]
					: undefined;
			if (!isEmpty(text)) {
				lines.push(`Creative brief (${key}): ${text}`);
			}
		}
	}

	const {
		avoid,
		aspect_ratio: aspectRatio,
		reference_notes: referenceNotes,
		prompt_extra: promptExtra,
		mood_keywords: moodKeywords,
	} = gen;

	if (Array.isArray(moodKeywords) && moodKeywords.length > 0) {
		lines.push(`Mood: ${moodKeywords.map(String).join(", ")}`);
	}

	if (!isEmpty(promptExtra)) {
		lines.push(String(promptExtra));
	}

	const styleBits = [
		art.style,
		art.finish,
		art.lighting,
		art.shading,
		framing.shot,
		framing.camera_angle,
	]
		.filter((b) => !isEmpty(b))
		.map((b) => String(b).replace(/_/g, " "));
	if (styleBits.length > 0) {
		lines.push(`Render: ${styleBits.join(", ")}.`);
	}

	const ratio = aspectRatio ?? "9:16";
	lines.push(`Aspect ratio ${ratio}. Professional anime key visual quality.`);

	if (Array.isArray(avoid) && avoid.length > 0) {
		lines.push(`Avoid: ${avoid.map(String).join(", ")}.`);
	}

	if (Array.isArray(locked) && locked.length > 0) {
		lines.push(`Locked (must not change): ${locked.map(String).join(", ")}.`);
	}

	if (!isEmpty(referenceNotes)) {
		lines.push(`Notes: ${referenceNotes}`);
	}

	return lines.join(" ");
}
