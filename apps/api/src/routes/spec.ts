import { specRenderRequestSchema } from "@charator/shared";
import {
  type CharacterSpec,
  CORE_PATHS,
  FIELD_CATALOG,
  listThemes,
  parseCharacterSpec,
  renderPrompt,
  SECTION_TITLES,
  THEME_IDS,
  type ThemeId,
  validateSpec,
} from "@charator/spec";
import { HttpError } from "../lib/errors";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

function negativePromptFromSpec(
  spec: Record<string, unknown>
): string | undefined {
  const { generation } = spec;
  if (
    !generation ||
    typeof generation !== "object" ||
    Array.isArray(generation)
  ) {
    return;
  }
  const { avoid } = generation as Record<string, unknown>;
  if (!Array.isArray(avoid)) {
    return;
  }
  const items = avoid
    .filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0
    )
    .map((item) => item.trim());
  return items.length > 0 ? items.join(", ") : undefined;
}

export function handleThemesList(_request: Request): Response {
  return json(
    listThemes().map((theme) => ({
      description: theme.description,
      id: theme.id,
      label: theme.label,
    }))
  );
}

export function handleSpecCatalog(_request: Request): Response {
  return json({
    corePaths: CORE_PATHS,
    fieldCatalog: FIELD_CATALOG,
    sectionTitles: SECTION_TITLES,
  });
}

export async function handleSpecRender(request: Request): Promise<Response> {
  const parsed = specRenderRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new HttpError(400, {
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "invalid request",
    });
  }

  let parsedSpec: CharacterSpec;
  try {
    parsedSpec = parseCharacterSpec(parsed.data.spec);
  } catch (error) {
    throw new HttpError(400, {
      cause: error,
      code: "validation_error",
      message: "spec could not be parsed",
    });
  }
  const spec = parsedSpec;

  const validation = validateSpec(spec);
  const theme =
    parsed.data.theme && THEME_IDS.includes(parsed.data.theme as ThemeId)
      ? (parsed.data.theme as ThemeId)
      : undefined;

  const prompt = renderPrompt(spec, theme ? { theme } : undefined);
  const negativePrompt = negativePromptFromSpec(
    spec as unknown as Record<string, unknown>
  );

  return json({
    ...(validation.ok ? {} : { errors: validation.errors }),
    ...(negativePrompt ? { negativePrompt } : {}),
    prompt,
  });
}
