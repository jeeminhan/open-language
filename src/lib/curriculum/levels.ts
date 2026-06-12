export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export interface CurriculumBootstrapRule {
  cefrLevel: CefrLevel;
  placement: JlptLevel;
  masteredGrammarLevels: JlptLevel[];
  activeGrammarLevel: JlptLevel;
  masteredVocabRank: number;
}

const RULES: Record<CefrLevel, CurriculumBootstrapRule> = {
  A1: {
    cefrLevel: "A1",
    placement: "N5",
    masteredGrammarLevels: [],
    activeGrammarLevel: "N5",
    masteredVocabRank: 500,
  },
  A2: {
    cefrLevel: "A2",
    placement: "N4",
    masteredGrammarLevels: ["N5"],
    activeGrammarLevel: "N4",
    masteredVocabRank: 1500,
  },
  B1: {
    cefrLevel: "B1",
    placement: "N3",
    masteredGrammarLevels: ["N5", "N4"],
    activeGrammarLevel: "N3",
    masteredVocabRank: 3000,
  },
  B2: {
    cefrLevel: "B2",
    placement: "N2",
    masteredGrammarLevels: ["N5", "N4", "N3"],
    activeGrammarLevel: "N2",
    masteredVocabRank: 6000,
  },
  C1: {
    cefrLevel: "C1",
    placement: "N1",
    masteredGrammarLevels: ["N5", "N4", "N3", "N2"],
    activeGrammarLevel: "N1",
    masteredVocabRank: 10000,
  },
  C2: {
    cefrLevel: "C2",
    placement: "N1",
    masteredGrammarLevels: ["N5", "N4", "N3", "N2", "N1"],
    activeGrammarLevel: "N1",
    masteredVocabRank: 10000,
  },
};

export function curriculumBootstrapRuleForLevel(level: string | null | undefined): CurriculumBootstrapRule {
  const normalized = String(level || "A2").toUpperCase();
  if (normalized in RULES) return RULES[normalized as CefrLevel];
  return RULES.A2;
}
