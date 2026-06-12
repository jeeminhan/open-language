export type SceneItemType = "vocab" | "grammar";
export type RecallMode = "active" | "passive";
export type QuizQuestionType = "multiple_choice" | "short_answer" | "yes_no";

export interface SceneLearner {
  id: string;
  name: string;
  native_language: string;
  target_language: string;
  proficiency_level: string | null;
}

export interface SceneDueVocab {
  id: string;
  word: string;
  reading: string | null;
  srs_state: string;
  interval_days: number;
  review_count: number;
  next_review_at: string | null;
}

export interface SceneDueGrammar {
  id: string;
  pattern: string;
  level: string | null;
  srs_state: string;
  interval_days: number;
  review_count: number;
  next_review_at: string | null;
}

export interface SceneLesson {
  id: string;
  type: SceneItemType;
  title: string;
  target: string;
  meaning: string;
  jlptLevel?: string | null;
  formation: string;
  examples: string[];
  commonMistakes: string[];
  scenarioTags: string[];
}

export interface SceneReviewItem {
  id: string;
  type: SceneItemType;
  text: string;
  reading?: string | null;
  meaning: string;
  jlptLevel?: string | null;
  frequencyRank?: number | null;
  srsState?: string | null;
  intervalDays?: number | null;
  reviewCount?: number | null;
  due: boolean;
  source: "srs" | "seed" | "curriculum";
  mode: RecallMode;
  scenarioTags: string[];
}

export interface DrillPrompt {
  id: string;
  targetItem: SceneReviewItem | SceneLesson;
  prompt: string;
  expectedUsage: string;
}

export interface RoleplayPlan {
  characterName: string;
  characterRole: string;
  scenario: string;
  learnerGoal: string;
  openingLine: string;
  passiveLines: string[];
  activeNudges: string[];
  successCriteria: string[];
  aiSystemPrompt: string;
}

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  targetText: string;
  targetType: SceneItemType;
  recallMode: RecallMode;
  choices?: string[];
  answer: string;
}

export interface QuestReward {
  clueNumber: number;
  totalClues: number;
  title: string;
  text: string;
  xp: number;
}

export interface Scene {
  id: string;
  title: string;
  location: string;
  storyContext: string;
  focusLesson: SceneLesson;
  reviewItems: SceneReviewItem[];
  drillPrompts: DrillPrompt[];
  roleplayScenario: RoleplayPlan;
  passiveRecallTargets: SceneReviewItem[];
  activeRecallTargets: Array<SceneReviewItem | SceneLesson>;
  quiz: QuizQuestion[];
  questReward: QuestReward;
  sessionDefaults: {
    sceneCount: number;
    newLessons: number;
    reviewItems: number;
    activeTargets: number;
    passiveTargets: number;
  };
  generatedAt: string;
}

export interface SceneCheck {
  itemType: SceneItemType;
  text: string;
  mode: RecallMode;
  correct: boolean;
  score: 0 | 1 | 2 | 3;
  evidence: string;
}

export interface SceneAttempt {
  drillAnswer: string;
  roleplayAnswer: string;
  quizAnswers: Record<string, string>;
}

export interface SceneEvaluation {
  checks: SceneCheck[];
  quizCorrect: number;
  quizTotal: number;
  activeCorrect: number;
  activeTotal: number;
  passiveCorrect: number;
  passiveTotal: number;
  xpEarned: number;
}
