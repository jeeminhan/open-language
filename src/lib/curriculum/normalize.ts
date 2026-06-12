import type {
  CurriculumAttribution,
  CurriculumLessonPlan,
  PickedGrammarItem,
  PickedVocabItem,
} from "./types";

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeVocabItem(value: unknown): PickedVocabItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const headword = typeof row.headword === "string" ? row.headword : "";
  const gloss = typeof row.gloss === "string" ? row.gloss : "";
  if (!id || !headword || !gloss) return null;
  return {
    id,
    headword,
    primaryReading:
      typeof row.primaryReading === "string"
        ? row.primaryReading
        : typeof row.primary_reading === "string"
          ? row.primary_reading
          : null,
    gloss,
    frequencyRank:
      numberOrNull(row.frequencyRank) ?? numberOrNull(row.frequency_rank),
    jlptLevel:
      typeof row.jlptLevel === "string"
        ? row.jlptLevel
        : typeof row.jlpt_level === "string"
          ? row.jlpt_level
          : null,
    tags: stringArray(row.tags),
    attribution:
      typeof row.attribution === "string" ? row.attribution : null,
  };
}

function normalizeGrammarItem(value: unknown): PickedGrammarItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : "";
  const name = typeof row.name === "string" ? row.name : "";
  const gloss = typeof row.gloss === "string" ? row.gloss : "";
  const jlptLevel =
    typeof row.jlptLevel === "string"
      ? row.jlptLevel
      : typeof row.jlpt_level === "string"
        ? row.jlpt_level
        : "";
  if (!id || !name || !gloss || !jlptLevel) return null;
  return {
    id,
    name,
    romaji: typeof row.romaji === "string" ? row.romaji : null,
    jlptLevel,
    gloss,
    tags: stringArray(row.tags),
    attribution:
      typeof row.attribution === "string" ? row.attribution : null,
  };
}

function normalizeAttribution(value: unknown): CurriculumAttribution[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.source !== "string" ||
      typeof row.label !== "string" ||
      typeof row.license !== "string" ||
      typeof row.url !== "string"
    ) {
      return [];
    }
    return [{
      source: row.source,
      label: row.label,
      license: row.license,
      url: row.url,
    }];
  });
}

export function normalizeCurriculumLessonPlan(value: unknown): CurriculumLessonPlan | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const scenarioId = typeof row.scenarioId === "string"
    ? row.scenarioId
    : typeof row.scenario_id === "string"
      ? row.scenario_id
      : "koenji-coffee-shop";
  const scenarioLabel = typeof row.scenarioLabel === "string"
    ? row.scenarioLabel
    : typeof row.scenario_label === "string"
      ? row.scenario_label
      : "Koenji coffee shop";
  return {
    snapshotId:
      typeof row.snapshotId === "string"
        ? row.snapshotId
        : typeof row.snapshot_id === "string"
          ? row.snapshot_id
          : null,
    scenarioId,
    scenarioLabel,
    scenarioTags: stringArray(row.scenarioTags ?? row.scenario_tags),
    explanation: typeof row.explanation === "string" ? row.explanation : "",
    vocab: Array.isArray(row.vocab)
      ? row.vocab.flatMap((item) => {
          const normalized = normalizeVocabItem(item);
          return normalized ? [normalized] : [];
        })
      : [],
    grammar: Array.isArray(row.grammar)
      ? row.grammar.flatMap((item) => {
          const normalized = normalizeGrammarItem(item);
          return normalized ? [normalized] : [];
        })
      : [],
    attribution: normalizeAttribution(row.attribution),
    fallback: row.fallback === true,
  };
}
