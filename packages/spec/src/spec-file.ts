/** Versioned `.charator.json` import/export envelope. */

import { z } from "zod";
import {
  type CharacterSpec,
  characterSpecSchema,
  parseCharacterSpec,
} from "./schema";
import { THEME_IDS, type ThemeId } from "./themes";
import { SPEC_VERSION } from "./validate";

export const CHARATOR_SPEC_FILE_VERSION = 1;

const themeIdSchema = z.union([
  z.enum(THEME_IDS as unknown as [ThemeId, ...ThemeId[]]),
  z.null(),
]);

export const specFileEnvelopeSchema = z.object({
  charator_spec: z.literal(CHARATOR_SPEC_FILE_VERSION),
  spec: characterSpecSchema,
  specVersion: z.literal(SPEC_VERSION),
  themeId: themeIdSchema,
});

export type SpecFileEnvelope = z.infer<typeof specFileEnvelopeSchema>;

export interface SpecFileExport {
  charator_spec: typeof CHARATOR_SPEC_FILE_VERSION;
  spec: CharacterSpec;
  specVersion: typeof SPEC_VERSION;
  themeId: ThemeId | null;
}

export function exportSpecFile(
  spec: CharacterSpec,
  themeId: ThemeId | null
): SpecFileExport {
  return {
    charator_spec: CHARATOR_SPEC_FILE_VERSION,
    spec,
    specVersion: SPEC_VERSION,
    themeId,
  };
}

export interface ParseSpecFileSuccess {
  ok: true;
  spec: CharacterSpec;
  themeId: ThemeId | null;
}

export interface ParseSpecFileFailure {
  errors: string[];
  ok: false;
}

export type ParseSpecFileResult = ParseSpecFileSuccess | ParseSpecFileFailure;

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "root";
    return `${path}: ${issue.message}`;
  });
}

/** Parse and validate a `.charator.json` envelope from raw JSON. */
export function parseSpecFile(input: unknown): ParseSpecFileResult {
  const envelopeResult = specFileEnvelopeSchema.safeParse(input);
  if (!envelopeResult.success) {
    const envelopeOnly = z
      .object({
        charator_spec: z.unknown(),
        specVersion: z.unknown(),
      })
      .safeParse(input);

    if (envelopeOnly.success) {
      if (envelopeOnly.data.charator_spec !== CHARATOR_SPEC_FILE_VERSION) {
        return {
          errors: [
            `unsupported charator_spec version (expected ${CHARATOR_SPEC_FILE_VERSION})`,
          ],
          ok: false,
        };
      }
      if (envelopeOnly.data.specVersion !== SPEC_VERSION) {
        return {
          errors: [`unsupported specVersion (expected ${SPEC_VERSION})`],
          ok: false,
        };
      }
    }

    return { errors: formatZodIssues(envelopeResult.error), ok: false };
  }

  try {
    const spec = parseCharacterSpec(envelopeResult.data.spec);
    return {
      ok: true,
      spec,
      themeId: envelopeResult.data.themeId,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { errors: formatZodIssues(error), ok: false };
    }
    return { errors: ["invalid character spec"], ok: false };
  }
}
