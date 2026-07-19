/** @charator/spec — character spec v2 engine (types, validation, prompt rendering). */

export { effectiveMode, shouldIncludeField } from "./control";
export {
	FIELD_CATALOG,
	type FieldCatalogEntry,
	type FieldKind,
	type FieldTier,
	QUICK_PRESETS,
} from "./data/catalog";
export { ENUM_FIELDS, type EnumPath } from "./data/enums";
export { CORE_PATHS, FINE_PATHS, SECTION_TITLES } from "./data/paths";
export { createEmptySpec } from "./empty";
export {
	enumForPath,
	isBoolField,
	isFreeList,
	isFreeString,
} from "./registry";
export { renderPromptBase } from "./render";
export {
	type CharacterSpec,
	characterSpecSchema,
	parseCharacterSpec,
} from "./schema";
export {
	getTheme,
	listThemes,
	type RenderPromptOptions,
	renderPrompt,
	THEME_IDS,
	THEME_PRESETS,
	type ThemeId,
	type ThemePreset,
} from "./themes";
export { formatValue, getPath, humanize, isEmpty, setPath } from "./utils";
export {
	balancedGenerateErrors,
	countCoreFilled,
	SPEC_VERSION,
	type ValidateResult,
	validateSpec,
	validateSpecForGenerate,
} from "./validate";
