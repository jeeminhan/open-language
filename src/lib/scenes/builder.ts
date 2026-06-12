import type {
  CurriculumLessonPlan,
  PickedGrammarItem,
  PickedVocabItem,
} from "@/lib/curriculum/types";
import {
  GENERIC_DISTRACTORS,
  GRAMMAR_METADATA,
  QUEST_SCENES,
  VOCAB_METADATA,
  fallbackMeaning,
  getGrammarMetadata,
  getVocabMetadata,
  type GrammarMetadata,
  type QuestSceneTemplate,
} from "./catalog";
import type {
  DrillPrompt,
  RecallMode,
  RoleplayPlan,
  Scene,
  SceneDueGrammar,
  SceneDueVocab,
  SceneLearner,
  SceneLesson,
  SceneReviewItem,
  QuizQuestion,
} from "./types";

export interface BuildSceneInput {
  learner: SceneLearner;
  dueVocab: SceneDueVocab[];
  dueGrammar: SceneDueGrammar[];
  lessonPlan: CurriculumLessonPlan | null;
  completedSceneCount: number;
  now?: Date;
}

interface SceneLoad {
  maxReviewItems: number;
  activeReviewItems: number;
}

function sceneLoadForLevel(level: string | null | undefined): SceneLoad {
  if (level === "A1") return { maxReviewItems: 3, activeReviewItems: 1 };
  if (level === "A2") return { maxReviewItems: 5, activeReviewItems: 1 };
  return { maxReviewItems: 5, activeReviewItems: 2 };
}

function uniqueByText(items: SceneReviewItem[]): SceneReviewItem[] {
  const seen = new Set<string>();
  const out: SceneReviewItem[] = [];
  for (const item of items) {
    const key = `${item.type}:${item.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function scenarioOverlapScore(tags: string[], scenarioTags: string[]): number {
  const scenario = new Set(scenarioTags);
  return tags.reduce((score, tag) => score + (scenario.has(tag) ? 1 : 0), 0);
}

function grammarLessonFromPicked(item: PickedGrammarItem): SceneLesson {
  const metadata = getGrammarMetadata(item.name);
  return {
    id: item.id,
    type: "grammar",
    title: item.name,
    target: item.name,
    meaning: item.gloss || metadata?.meaning || fallbackMeaning("grammar", item.name),
    jlptLevel: item.jlptLevel || metadata?.jlptLevel,
    formation: metadata?.formation || `Use ${item.name} in a complete sentence.`,
    examples: metadata?.exampleSentences ?? [],
    commonMistakes: metadata?.commonMistakes ?? [],
    scenarioTags: item.tags.length > 0 ? item.tags : metadata?.scenarioTags ?? [],
  };
}

function grammarLessonFromMetadata(metadata: GrammarMetadata): SceneLesson {
  return {
    id: `seed-grammar-${metadata.pattern}`,
    type: "grammar",
    title: metadata.pattern,
    target: metadata.pattern,
    meaning: metadata.meaning,
    jlptLevel: metadata.jlptLevel,
    formation: metadata.formation,
    examples: metadata.exampleSentences,
    commonMistakes: metadata.commonMistakes,
    scenarioTags: metadata.scenarioTags,
  };
}

function chooseFocusLesson(input: BuildSceneInput): SceneLesson {
  const pickedGrammar = input.lessonPlan?.grammar[0];
  if (pickedGrammar) return grammarLessonFromPicked(pickedGrammar);

  const dueGrammar = input.dueGrammar[0];
  if (dueGrammar) {
    const metadata = getGrammarMetadata(dueGrammar.pattern);
    if (metadata) return grammarLessonFromMetadata(metadata);
    return {
      id: dueGrammar.id,
      type: "grammar",
      title: dueGrammar.pattern,
      target: dueGrammar.pattern,
      meaning: fallbackMeaning("grammar", dueGrammar.pattern),
      jlptLevel: dueGrammar.level,
      formation: `Use ${dueGrammar.pattern} in a complete sentence.`,
      examples: [],
      commonMistakes: [],
      scenarioTags: [],
    };
  }

  return grammarLessonFromMetadata(GRAMMAR_METADATA["つもり"]);
}

function reviewFromDueVocab(item: SceneDueVocab): SceneReviewItem {
  const metadata = getVocabMetadata(item.word);
  return {
    id: item.id,
    type: "vocab",
    text: item.word,
    reading: item.reading ?? metadata?.reading,
    meaning: metadata?.meaning ?? fallbackMeaning("vocab", item.word),
    jlptLevel: metadata?.jlptLevel,
    frequencyRank: metadata?.frequencyRank,
    srsState: item.srs_state,
    intervalDays: item.interval_days,
    reviewCount: item.review_count,
    due: true,
    source: "srs",
    mode: "passive",
    scenarioTags: metadata?.scenarioTags ?? [],
  };
}

function reviewFromDueGrammar(item: SceneDueGrammar): SceneReviewItem {
  const metadata = getGrammarMetadata(item.pattern);
  return {
    id: item.id,
    type: "grammar",
    text: item.pattern,
    meaning: metadata?.meaning ?? fallbackMeaning("grammar", item.pattern),
    jlptLevel: item.level ?? metadata?.jlptLevel,
    srsState: item.srs_state,
    intervalDays: item.interval_days,
    reviewCount: item.review_count,
    due: true,
    source: "srs",
    mode: "passive",
    scenarioTags: metadata?.scenarioTags ?? [],
  };
}

function reviewFromPickedVocab(item: PickedVocabItem): SceneReviewItem {
  const metadata = getVocabMetadata(item.headword);
  return {
    id: item.id,
    type: "vocab",
    text: item.headword,
    reading: item.primaryReading ?? metadata?.reading,
    meaning: item.gloss || metadata?.meaning || fallbackMeaning("vocab", item.headword),
    jlptLevel: item.jlptLevel ?? metadata?.jlptLevel,
    frequencyRank: item.frequencyRank ?? metadata?.frequencyRank,
    due: false,
    source: "curriculum",
    mode: "passive",
    scenarioTags: item.tags.length > 0 ? item.tags : metadata?.scenarioTags ?? [],
  };
}

function reviewFromSeedWord(word: string): SceneReviewItem {
  const metadata = VOCAB_METADATA[word];
  return {
    id: `seed-vocab-${word}`,
    type: "vocab",
    text: word,
    reading: metadata?.reading,
    meaning: metadata?.meaning ?? fallbackMeaning("vocab", word),
    jlptLevel: metadata?.jlptLevel,
    frequencyRank: metadata?.frequencyRank,
    due: false,
    source: "seed",
    mode: "passive",
    scenarioTags: metadata?.scenarioTags ?? [],
  };
}

function collectReviewItems(input: BuildSceneInput, template: QuestSceneTemplate): SceneReviewItem[] {
  const dueGrammar = input.dueGrammar.map(reviewFromDueGrammar);
  const dueVocab = input.dueVocab.map(reviewFromDueVocab);
  const curriculumVocab = (input.lessonPlan?.vocab ?? []).map(reviewFromPickedVocab);
  const seed = template.seedReviewWords.map(reviewFromSeedWord);

  return uniqueByText([...dueGrammar, ...dueVocab, ...curriculumVocab, ...seed])
    .sort((a, b) => {
      if (a.due !== b.due) return a.due ? -1 : 1;
      const aState = a.srsState === "learning" ? 0 : a.srsState === "reviewing" ? 1 : 2;
      const bState = b.srsState === "learning" ? 0 : b.srsState === "reviewing" ? 1 : 2;
      if (aState !== bState) return aState - bState;
      return scenarioOverlapScore(b.scenarioTags, template.scenarioTags) -
        scenarioOverlapScore(a.scenarioTags, template.scenarioTags);
    });
}

function assignRecallModes(
  items: SceneReviewItem[],
  focusLesson: SceneLesson,
  load: SceneLoad
): SceneReviewItem[] {
  const active: SceneReviewItem[] = [];
  const focusKey = `${focusLesson.type}:${focusLesson.target}`;

  for (const item of items) {
    const key = `${item.type}:${item.text}`;
    if (key === focusKey) continue;
    if (active.length >= load.activeReviewItems) break;
    if (item.due && (item.srsState === "learning" || item.type === "grammar")) {
      active.push(item);
    }
  }

  for (const item of items) {
    if (active.length >= load.activeReviewItems) break;
    if (!active.includes(item) && `${item.type}:${item.text}` !== focusKey) {
      active.push(item);
    }
  }

  const activeKeys = new Set(active.map((item) => `${item.type}:${item.text}`));
  return items.map((item) => ({
    ...item,
    mode: activeKeys.has(`${item.type}:${item.text}`) ? "active" : "passive",
  }));
}

function firstPromptForItem(item: SceneReviewItem | SceneLesson, template: QuestSceneTemplate): string {
  if (item.type === "grammar") {
    const metadata = "text" in item ? getGrammarMetadata(item.text) : getGrammarMetadata(item.target);
    return metadata?.activePromptTemplates[0] ??
      `You are in ${template.location}. Answer with ${"target" in item ? item.target : item.text}.`;
  }

  const metadata = "text" in item ? getVocabMetadata(item.text) : undefined;
  return metadata?.activePromptTemplates[0] ??
    `You are in ${template.location}. Describe what happens using ${"text" in item ? item.text : item.target}.`;
}

function buildDrillPrompts(
  template: QuestSceneTemplate,
  focusLesson: SceneLesson,
  reviewItems: SceneReviewItem[]
): DrillPrompt[] {
  const activeReview = reviewItems.find((item) => item.mode === "active");
  const target = activeReview ?? focusLesson;
  const targetText = "target" in target ? target.target : target.text;
  return [
    {
      id: `${template.id}-drill-1`,
      targetItem: target,
      prompt: firstPromptForItem(target, template),
      expectedUsage:
        target.type === "grammar"
          ? `Use ${targetText} to express the intended meaning, not as an isolated label.`
          : `Use ${targetText} naturally in one complete Japanese sentence.`,
    },
  ];
}

function passiveLineForItem(item: SceneReviewItem, index: number): string {
  if (item.type === "vocab") {
    const metadata = getVocabMetadata(item.text);
    if (metadata?.passiveExampleTemplates[index % metadata.passiveExampleTemplates.length]) {
      return metadata.passiveExampleTemplates[index % metadata.passiveExampleTemplates.length];
    }
  } else {
    const metadata = getGrammarMetadata(item.text);
    if (metadata?.passiveExampleTemplates[index % metadata.passiveExampleTemplates.length]) {
      return metadata.passiveExampleTemplates[index % metadata.passiveExampleTemplates.length];
    }
  }
  return `${item.text}という言葉が、今日の手がかりに出てきました。`;
}

function activeNudgeForTarget(target: SceneReviewItem | SceneLesson): string {
  const targetText = "target" in target ? target.target : target.text;
  if (target.type === "grammar") {
    return `Ask one question whose natural answer uses ${targetText}.`;
  }
  return `Create one opening where the learner can naturally say ${targetText}.`;
}

function buildRoleplayPlan(
  template: QuestSceneTemplate,
  focusLesson: SceneLesson,
  reviewItems: SceneReviewItem[]
): RoleplayPlan {
  const activeTargets = [focusLesson, ...reviewItems.filter((item) => item.mode === "active")];
  const passiveTargets = reviewItems.filter((item) => item.mode === "passive");
  const passiveLines = passiveTargets.slice(0, 4).map(passiveLineForItem);
  const firstPassiveLine = passiveLines[0] ?? "今日は少し変わった日ですね。";
  const activeList = activeTargets.map((item) => "target" in item ? item.target : item.text).join(", ");
  const passiveList = passiveTargets.map((item) => item.text).join(", ") || "none";

  return {
    characterName: template.characterName,
    characterRole: template.characterRole,
    scenario: template.storyContext,
    learnerGoal: `Use ${focusLesson.target} once to unlock the next clue.`,
    openingLine: `いらっしゃいませ。${firstPassiveLine} このあと、どうする${focusLesson.target.includes("つもり") ? "つもりですか" : "予定ですか"}？`,
    passiveLines,
    activeNudges: activeTargets.map(activeNudgeForTarget),
    successCriteria: [
      `Learner uses ${focusLesson.target} with the intended meaning.`,
      "Tutor uses passive review words naturally before the quiz.",
      "Tutor asks one question at a time.",
    ],
    aiSystemPrompt: `You are running a Japanese learning scene.

Learner level: ${focusLesson.jlptLevel ?? "adaptive"}
Location: ${template.location}
Main lesson target: ${focusLesson.target} = ${focusLesson.meaning}
Active targets: ${activeList}
Passive targets: ${passiveList}
Goal: learner should use ${focusLesson.target} correctly once.
Style: immersive, calm, story-driven, one question at a time.
Use passive target words naturally in your own speech.
Do not ask the learner to juggle every target in one answer.
After the roleplay, quiz passive targets for meaning in context.`,
  };
}

function choicesForAnswer(answer: string): string[] {
  const choices = [answer];
  for (const distractor of GENERIC_DISTRACTORS) {
    if (choices.length >= 4) break;
    if (distractor.toLowerCase() !== answer.toLowerCase()) choices.push(distractor);
  }
  return choices.sort((a, b) => a.localeCompare(b));
}

function buildQuiz(
  template: QuestSceneTemplate,
  focusLesson: SceneLesson,
  reviewItems: SceneReviewItem[]
): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const passiveItems = reviewItems.filter((item) => item.mode === "passive").slice(0, 3);
  for (const item of passiveItems) {
    questions.push({
      id: `${template.id}-quiz-passive-${item.id}`,
      type: "multiple_choice",
      prompt: `In the scene, what did ${item.text} mean?`,
      targetText: item.text,
      targetType: item.type,
      recallMode: "passive",
      choices: choicesForAnswer(item.meaning),
      answer: item.meaning,
    });
  }

  questions.push({
    id: `${template.id}-quiz-lesson-${focusLesson.id}`,
    type: "short_answer",
    prompt: `Write one short Japanese sentence with ${focusLesson.target}.`,
    targetText: focusLesson.target,
    targetType: focusLesson.type,
    recallMode: "active",
    answer: focusLesson.target,
  });

  if (reviewItems.some((item) => item.text === "約束")) {
    questions.push({
      id: `${template.id}-quiz-yakusoku-seen`,
      type: "yes_no",
      prompt: "Did 約束 appear in the scene materials?",
      targetText: "約束",
      targetType: "vocab",
      recallMode: "passive",
      choices: ["yes", "no"],
      answer: "yes",
    });
  }

  return questions.slice(0, 5);
}

function questRewardFor(template: QuestSceneTemplate, completedSceneCount: number) {
  const clueNumber = (completedSceneCount % QUEST_SCENES.length) + 1;
  return {
    clueNumber,
    totalClues: QUEST_SCENES.length,
    title: template.clueTitle,
    text: template.clueText,
    xp: 40 + clueNumber * 5,
  };
}

export function buildScene(input: BuildSceneInput): Scene {
  const template = QUEST_SCENES[input.completedSceneCount % QUEST_SCENES.length];
  const load = sceneLoadForLevel(input.learner.proficiency_level);
  const focusLesson = chooseFocusLesson(input);
  const collected = collectReviewItems(input, template).slice(0, load.maxReviewItems);
  const reviewItems = assignRecallModes(collected, focusLesson, load);
  const activeRecallTargets = [
    focusLesson,
    ...reviewItems.filter((item) => item.mode === "active"),
  ];
  const passiveRecallTargets = reviewItems.filter((item) => item.mode === "passive");

  return {
    id: `${template.id}-${focusLesson.id}`,
    title: template.title,
    location: template.location,
    storyContext: template.storyContext,
    focusLesson,
    reviewItems,
    drillPrompts: buildDrillPrompts(template, focusLesson, reviewItems),
    roleplayScenario: buildRoleplayPlan(template, focusLesson, reviewItems),
    activeRecallTargets,
    passiveRecallTargets,
    quiz: buildQuiz(template, focusLesson, reviewItems),
    questReward: questRewardFor(template, input.completedSceneCount),
    sessionDefaults: {
      sceneCount: 1,
      newLessons: 1,
      reviewItems: reviewItems.length,
      activeTargets: activeRecallTargets.length,
      passiveTargets: passiveRecallTargets.length,
    },
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function itemDisplayText(item: SceneReviewItem | SceneLesson): string {
  if ("target" in item) return item.target;
  return item.reading ? `${item.text} (${item.reading})` : item.text;
}

export function recallModeLabel(mode: RecallMode): string {
  return mode === "active" ? "active recall" : "passive recall";
}
