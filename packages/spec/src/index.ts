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
export {
  diffSpecs,
  type SpecDiffChange,
  type SpecDiffResult,
  type SpecDiffSection,
  type SpecDiffValue,
} from "./diff";
export { createEmptySpec } from "./empty";
export { MAX_ST_CARD_PNG_BYTES } from "./limits";
export {
  applyPromptTemplateSuffix,
  PROMPT_TEMPLATE_FAMILIES,
  type PromptTemplateFamily,
} from "./prompt-templates";
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
  buildSheetVariants,
  getSheetPreset,
  listSheetPresets,
  SHEET_PRESET_IDS,
  SHEET_PRESETS,
  type SheetPresetDefinition,
  type SheetPresetId,
  type SheetVariantDefinition,
  type SheetVariantResult,
  sheetVariantCount,
} from "./sheet-presets";
export {
  CHARATOR_SPEC_FILE_VERSION,
  exportSpecFile,
  type ParseSpecFileFailure,
  type ParseSpecFileResult,
  type ParseSpecFileSuccess,
  parseSpecFile,
  type SpecFileEnvelope,
  type SpecFileExport,
  specFileEnvelopeSchema,
} from "./spec-file";
export {
  CHARATOR_EXTENSION_KEY,
  composeStCardDescription,
  composeStCardMesExample,
  composeStCardPostHistoryInstructions,
  composeStCardSystemPrompt,
  encodeStCardChunks,
  exportStCard,
  type ImportStCardResult,
  importStCardFromJson,
  isUnmappedStField,
  type LossyField,
  listUnmappedStFields,
  ST_CARD_SPEC,
  ST_CARD_SPEC_VERSION,
  ST_CARD_V2_SPEC,
  ST_CARD_V2_SPEC_VERSION,
  type StCardExportResult,
  type StCardSourceFormat,
} from "./st-card";
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
