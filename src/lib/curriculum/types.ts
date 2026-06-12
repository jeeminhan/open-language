export type CurriculumStatus = "unknown" | "introduced" | "practiced" | "mastered";

export interface CurriculumAttribution {
  source: string;
  label: string;
  license: string;
  url: string;
}

export interface PickedVocabItem {
  id: string;
  headword: string;
  primaryReading?: string | null;
  gloss: string;
  frequencyRank?: number | null;
  jlptLevel?: string | null;
  tags: string[];
  attribution?: string | null;
}

export interface PickedGrammarItem {
  id: string;
  name: string;
  romaji?: string | null;
  jlptLevel: string;
  gloss: string;
  tags: string[];
  attribution?: string | null;
}

export interface CurriculumLessonPlan {
  snapshotId: string | null;
  scenarioId: string;
  scenarioLabel: string;
  scenarioTags: string[];
  explanation: string;
  vocab: PickedVocabItem[];
  grammar: PickedGrammarItem[];
  attribution: CurriculumAttribution[];
  fallback: boolean;
}

export function hasPickedCurriculum(plan: CurriculumLessonPlan | null | undefined): plan is CurriculumLessonPlan {
  return Boolean(plan && (plan.vocab.length > 0 || plan.grammar.length > 0));
}
