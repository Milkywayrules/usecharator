/** Launch theme presets layered on top of base prompt rendering. */

import { renderPromptBase } from "./render";
import type { CharacterSpec } from "./schema";

export const THEME_IDS = [
	"anime",
	"manga",
	"marvel-comic",
	"western-cartoon",
	"pixel-art",
	"watercolor",
	"3d-render",
	"chibi",
	"semi-realistic",
	"gacha",
	"dark-cinematic",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemePreset {
	artDirection: readonly string[];
	description: string;
	id: ThemeId;
	label: string;
	negativePrompts: readonly string[];
	promptFlavor: readonly string[];
}

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
	"3d-render": {
		artDirection: [
			"3D rendered character with smooth polygon surfaces",
			"subsurface scattering on skin and hair",
			"studio three-point lighting setup",
			"polished CGI quality with ambient occlusion",
		],
		description: "Polished 3D character render with subsurface scattering.",
		id: "3d-render",
		label: "3D Render",
		negativePrompts: ["2d", "flat", "hand drawn", "sketch", "manga"],
		promptFlavor: ["3D render", "CGI character"],
	},
	anime: {
		artDirection: [
			"clean anime linework with consistent line weight",
			"cel-shaded shadows with soft gradient transitions",
			"vibrant saturated palette typical of seasonal anime",
			"expressive anime eyes with sharp highlight catchlights",
		],
		description:
			"Clean modern TV anime — crisp linework, cel shading, vibrant colors.",
		id: "anime",
		label: "Anime",
		negativePrompts: ["realistic", "photograph", "3d render", "western comic"],
		promptFlavor: ["modern anime", "seasonal TV quality"],
	},
	chibi: {
		artDirection: [
			"chibi super-deformed proportions with oversized head",
			"simplified cute facial features with dot eyes option",
			"minimal body detail with stubby limbs",
			"bright cheerful colors with soft cel shading",
		],
		description:
			"Super-deformed cute chibi with oversized head and simplified body.",
		id: "chibi",
		label: "Chibi",
		negativePrompts: [
			"realistic proportions",
			"detailed anatomy",
			"serious",
			"horror",
		],
		promptFlavor: ["chibi", "super deformed cute"],
	},
	"dark-cinematic": {
		artDirection: [
			"dark cinematic anime with high contrast lighting",
			"deep shadows and selective rim highlights",
			"desaturated moody color palette with accent pops",
			"film noir influenced composition and atmosphere",
		],
		description: "Moody high-contrast cinematic anime with deep shadows.",
		id: "dark-cinematic",
		label: "Dark Cinematic",
		negativePrompts: ["bright pastel", "cheerful", "flat lighting", "chibi"],
		promptFlavor: ["dark cinematic", "moody anime"],
	},
	gacha: {
		artDirection: [
			"gacha mobile game splash art quality",
			"high detail rendering with glossy highlights",
			"dramatic rim lighting and particle effects",
			"polished commercial game illustration finish",
		],
		description:
			"Mobile gacha game splash art — glossy, high detail, dramatic lighting.",
		id: "gacha",
		label: "Gacha",
		negativePrompts: ["sketch", "rough", "monochrome", "low detail"],
		promptFlavor: ["gacha splash art", "mobile game illustration"],
	},
	manga: {
		artDirection: [
			"black and white manga ink illustration",
			"screentone halftone shading patterns",
			"bold confident ink strokes with varied line weight",
			"high contrast monochrome with minimal gray",
		],
		description: "Black-and-white manga ink with screentone shading.",
		id: "manga",
		label: "Manga",
		negativePrompts: ["color", "full color", "photorealistic", "3d"],
		promptFlavor: ["manga panel", "ink illustration"],
	},
	"marvel-comic": {
		artDirection: [
			"American comic book style with bold black outlines",
			"dynamic foreshortening and heroic proportions",
			"halftone dot color fills and cross-hatching shadows",
			"high contrast primary color palette",
		],
		description:
			"American superhero comic book — bold inks, dynamic poses, halftone color.",
		id: "marvel-comic",
		label: "Marvel Comic",
		negativePrompts: ["anime", "manga", "chibi", "soft pastel"],
		promptFlavor: ["superhero comic", "Marvel-style illustration"],
	},
	"pixel-art": {
		artDirection: [
			"pixel art style with visible square pixels",
			"limited color palette with dithering for gradients",
			"crisp pixel-perfect edges without anti-aliasing",
			"retro game sprite aesthetic",
		],
		description: "Retro pixel art sprite aesthetic with limited palette.",
		id: "pixel-art",
		label: "Pixel Art",
		negativePrompts: [
			"smooth gradients",
			"high resolution",
			"photorealistic",
			"vector",
		],
		promptFlavor: ["pixel art", "retro game sprite"],
	},
	"semi-realistic": {
		artDirection: [
			"semi-realistic anime with detailed anatomy and shading",
			"nuanced skin texture and realistic light falloff",
			"refined linework blended with painted rendering",
			"subtle color grading for cinematic depth",
		],
		description:
			"Detailed semi-realistic anime with nuanced shading and anatomy.",
		id: "semi-realistic",
		label: "Semi-Realistic",
		negativePrompts: ["chibi", "flat cel", "simple", "cartoon"],
		promptFlavor: ["semi-realistic anime", "detailed illustration"],
	},
	watercolor: {
		artDirection: [
			"watercolor painting technique with soft wet edges",
			"visible paper texture and pigment bleeding",
			"loose expressive brushstrokes with color pooling",
			"muted translucent washes with white paper showing through",
		],
		description: "Soft watercolor painterly illustration with paper texture.",
		id: "watercolor",
		label: "Watercolor",
		negativePrompts: [
			"cel shaded",
			"digital hard edges",
			"photorealistic",
			"3d render",
		],
		promptFlavor: ["watercolor illustration", "painterly"],
	},
	"western-cartoon": {
		artDirection: [
			"western cartoon animation style with simplified shapes",
			"flat color fills with minimal shading",
			"exaggerated expressive proportions and silhouettes",
			"thick clean outlines with rounded corners",
		],
		description:
			"Western animation — flat colors, simplified shapes, expressive silhouettes.",
		id: "western-cartoon",
		label: "Western Cartoon",
		negativePrompts: ["anime", "realistic", "detailed shading", "manga"],
		promptFlavor: ["cartoon animation", "western animated series"],
	},
};

export interface RenderPromptOptions {
	theme?: ThemeId;
}

function formatThemeBlock(theme: ThemePreset): string {
	const lines = [...theme.artDirection];
	if (theme.promptFlavor.length > 0) {
		lines.push(...theme.promptFlavor);
	}
	return `Theme — ${theme.id}: ${lines.join("; ")}.`;
}

function mergeAvoidLists(
	existing: string[],
	themeNegatives: readonly string[],
): string[] {
	const seen = new Set<string>();
	const merged: string[] = [];
	for (const item of [...existing, ...themeNegatives]) {
		const key = item.toLowerCase();
		if (!seen.has(key)) {
			seen.add(key);
			merged.push(item);
		}
	}
	return merged;
}

/** Render prompt with optional theme overlay. Base output is byte-identical to Python when no theme. */
export function renderPrompt(
	spec: CharacterSpec,
	options?: RenderPromptOptions,
): string {
	const base = renderPromptBase(spec);

	if (!options?.theme) {
		return base;
	}

	const theme = THEME_PRESETS[options.theme];
	if (!theme) {
		return base;
	}

	const themeBlock = formatThemeBlock(theme);
	const avoidMarker = "Avoid: ";
	const avoidIdx = base.indexOf(avoidMarker);

	if (avoidIdx >= 0) {
		const beforeAvoid = base.slice(0, avoidIdx);
		const avoidRest = base.slice(avoidIdx + avoidMarker.length);
		const dotIdx = avoidRest.lastIndexOf(".");
		const avoidContent = dotIdx >= 0 ? avoidRest.slice(0, dotIdx) : avoidRest;
		const afterAvoid = dotIdx >= 0 ? avoidRest.slice(dotIdx) : "";

		const existingAvoid = avoidContent
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		const merged = mergeAvoidLists(existingAvoid, theme.negativePrompts);

		return `${beforeAvoid}${themeBlock} ${avoidMarker}${merged.join(", ")}${afterAvoid}`;
	}

	return `${base} ${themeBlock}`;
}

export function getTheme(id: ThemeId): ThemePreset {
	return THEME_PRESETS[id];
}

export function listThemes(): ThemePreset[] {
	return THEME_IDS.map((id) => THEME_PRESETS[id]);
}
