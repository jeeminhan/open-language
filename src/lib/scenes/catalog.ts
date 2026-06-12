import type { SceneItemType } from "./types";

export interface QuestSceneTemplate {
  id: string;
  title: string;
  location: string;
  storyContext: string;
  characterName: string;
  characterRole: string;
  clueTitle: string;
  clueText: string;
  seedReviewWords: string[];
  scenarioTags: string[];
}

export interface VocabMetadata {
  word: string;
  reading: string;
  meaning: string;
  partOfSpeech: string;
  jlptLevel: string;
  frequencyRank: number | null;
  scenarioTags: string[];
  activePromptTemplates: string[];
  passiveExampleTemplates: string[];
  commonCollocations: string[];
}

export interface GrammarMetadata {
  pattern: string;
  meaning: string;
  jlptLevel: string;
  formation: string;
  exampleSentences: string[];
  commonMistakes: string[];
  scenarioTags: string[];
  activePromptTemplates: string[];
  passiveExampleTemplates: string[];
}

export const QUEST_SCENES: QuestSceneTemplate[] = [
  {
    id: "cafe-window",
    title: "The Cafe Window",
    location: "Small cafe in Kyoto",
    storyContext:
      "You are waiting for a mysterious person who left a note under your cup.",
    characterName: "Yuki",
    characterRole: "barista who knows the old neighborhood stories",
    clueTitle: "Map edge",
    clueText:
      "A torn map edge shows a window, a moon, and the first line of a poem.",
    seedReviewWords: ["窓", "約束", "不思議", "冒険", "天気"],
    scenarioTags: ["cafe", "mystery", "plans", "weather"],
  },
  {
    id: "station-platform",
    title: "The Platform Bell",
    location: "Late-night train platform in Nara",
    storyContext:
      "A station attendant says the bell rings only when someone is carrying the next clue.",
    characterName: "Mori",
    characterRole: "station attendant with a dry sense of humor",
    clueTitle: "Timetable mark",
    clueText:
      "The timetable has one impossible departure time circled in red pencil.",
    seedReviewWords: ["電車", "切符", "遅れる", "地図", "静か"],
    scenarioTags: ["train", "travel", "mystery", "time"],
  },
  {
    id: "shrine-steps",
    title: "The Shrine Steps",
    location: "Quiet shrine above a shopping street",
    storyContext:
      "The shrine keeper will reveal a clue if you explain why you came today.",
    characterName: "Sanae",
    characterRole: "shrine keeper who speaks in gentle hints",
    clueTitle: "Paper charm",
    clueText:
      "A paper charm lists two directions and one word that should not be there.",
    seedReviewWords: ["神社", "階段", "願い", "守る", "秘密"],
    scenarioTags: ["shrine", "promise", "mystery", "feelings"],
  },
  {
    id: "market-lanterns",
    title: "The Lantern Market",
    location: "Covered market in Osaka",
    storyContext:
      "A vegetable seller claims every clue has to be paid for with a strange metaphor.",
    characterName: "Tanaka",
    characterRole: "shopkeeper who loves absurd comparisons",
    clueTitle: "Lantern receipt",
    clueText:
      "The receipt has a lantern sketch and a phrase about tomorrow's rain.",
    seedReviewWords: ["市場", "野菜", "値段", "明日", "比べる"],
    scenarioTags: ["market", "food", "weird", "bargaining"],
  },
  {
    id: "festival-bridge",
    title: "The Festival Bridge",
    location: "Riverside festival bridge in Fukuoka",
    storyContext:
      "A festival musician remembers the next verse but only after you ask about their plan.",
    characterName: "Ren",
    characterRole: "festival musician carrying a scratched shamisen case",
    clueTitle: "Song fragment",
    clueText:
      "A song fragment mentions a bridge shadow and a name you have not heard yet.",
    seedReviewWords: ["祭り", "橋", "歌", "覚える", "急ぐ"],
    scenarioTags: ["festival", "music", "plans", "memory"],
  },
  {
    id: "rain-inn",
    title: "The Rain Inn",
    location: "Old inn near a mountain road",
    storyContext:
      "The innkeeper says a previous traveler left a promise in the guest book.",
    characterName: "Aki",
    characterRole: "innkeeper who notices every small detail",
    clueTitle: "Guest-book line",
    clueText:
      "The guest book has one line written upside down beside a pressed leaf.",
    seedReviewWords: ["旅館", "雨", "部屋", "名前", "思い出す"],
    scenarioTags: ["inn", "weather", "promise", "memory"],
  },
  {
    id: "mountain-path",
    title: "The Mountain Path",
    location: "Cedar path outside Hakone",
    storyContext:
      "A hiker has seen the symbol from your map carved into an old signpost.",
    characterName: "Nao",
    characterRole: "hiker who pretends not to be superstitious",
    clueTitle: "Signpost symbol",
    clueText:
      "The signpost points toward a place missing from every normal map.",
    seedReviewWords: ["山", "道", "危ない", "戻る", "見つける"],
    scenarioTags: ["nature", "travel", "warning", "mystery"],
  },
  {
    id: "old-bookstore",
    title: "The Old Bookstore",
    location: "Second-floor used bookstore in Jinbocho",
    storyContext:
      "A bookseller finds your clue familiar but wants to hear what you intend to do with it.",
    characterName: "Ishida",
    characterRole: "bookseller who remembers customers by the books they touch",
    clueTitle: "Missing page",
    clueText:
      "A missing page number matches the impossible time from the train station.",
    seedReviewWords: ["本屋", "古い", "探す", "物語", "最後"],
    scenarioTags: ["bookstore", "plans", "story", "mystery"],
  },
  {
    id: "temple-courtyard",
    title: "The Temple Courtyard",
    location: "Temple courtyard at dusk",
    storyContext:
      "The poem is almost complete, but one line can only be understood in context.",
    characterName: "Mika",
    characterRole: "guide who speaks plainly when the puzzle gets too strange",
    clueTitle: "Final verse",
    clueText:
      "The final verse says the treasure is not hidden under the city, but inside a promise.",
    seedReviewWords: ["寺", "夕方", "詩", "意味", "答え"],
    scenarioTags: ["temple", "meaning", "mystery", "finale"],
  },
  {
    id: "map-room",
    title: "The Map Room",
    location: "Tiny archive behind a closed cafe",
    storyContext:
      "Every clue leads back to the first window, where the map can finally be read.",
    characterName: "Yuki",
    characterRole: "barista who has been guarding the archive key",
    clueTitle: "Treasure reveal",
    clueText:
      "The treasure is a route through the city that only appears when read as a conversation.",
    seedReviewWords: ["鍵", "宝物", "読む", "始まる", "続ける"],
    scenarioTags: ["cafe", "archive", "mystery", "review"],
  },
];

export const VOCAB_METADATA: Record<string, VocabMetadata> = {
  窓: {
    word: "窓",
    reading: "まど",
    meaning: "window",
    partOfSpeech: "noun",
    jlptLevel: "N5",
    frequencyRank: 1635,
    scenarioTags: ["cafe", "train", "home", "weather", "mystery"],
    activePromptTemplates: [
      "You are in a cafe and notice something outside the window. Use 窓.",
      "You are on a train. Describe what you see through the window.",
    ],
    passiveExampleTemplates: [
      "窓の外を見てください。",
      "窓の近くの席でもいいですか？",
    ],
    commonCollocations: ["窓の外", "窓際", "窓を開ける"],
  },
  約束: {
    word: "約束",
    reading: "やくそく",
    meaning: "promise; appointment",
    partOfSpeech: "noun/suru verb",
    jlptLevel: "N4",
    frequencyRank: 1040,
    scenarioTags: ["promise", "plans", "friends", "mystery"],
    activePromptTemplates: [
      "Someone left a note about a promise. Explain what the promise was using 約束.",
    ],
    passiveExampleTemplates: [
      "その約束を覚えていますか？",
      "古い約束が、この地図と関係あるんです。",
    ],
    commonCollocations: ["約束する", "約束を守る", "約束を忘れる"],
  },
  不思議: {
    word: "不思議",
    reading: "ふしぎ",
    meaning: "mysterious; strange",
    partOfSpeech: "na-adjective/noun",
    jlptLevel: "N4",
    frequencyRank: 1198,
    scenarioTags: ["mystery", "story", "feelings"],
    activePromptTemplates: [
      "A normal place suddenly feels strange. Describe it using 不思議.",
    ],
    passiveExampleTemplates: [
      "ちょっと不思議なものがあります。",
      "不思議ですね。この印、前にも見ました。",
    ],
    commonCollocations: ["不思議な", "不思議に思う", "不思議な話"],
  },
  冒険: {
    word: "冒険",
    reading: "ぼうけん",
    meaning: "adventure",
    partOfSpeech: "noun/suru verb",
    jlptLevel: "N3",
    frequencyRank: 2705,
    scenarioTags: ["travel", "mystery", "story"],
    activePromptTemplates: [
      "You realize the map is turning today into an adventure. Use 冒険.",
    ],
    passiveExampleTemplates: [
      "これは小さな冒険かもしれませんね。",
      "冒険には、変な約束がつきものです。",
    ],
    commonCollocations: ["冒険する", "小さな冒険", "冒険が始まる"],
  },
  天気: {
    word: "天気",
    reading: "てんき",
    meaning: "weather",
    partOfSpeech: "noun",
    jlptLevel: "N5",
    frequencyRank: 1260,
    scenarioTags: ["weather", "small-talk", "travel"],
    activePromptTemplates: [
      "The weather changes just as you receive a clue. Use 天気.",
    ],
    passiveExampleTemplates: [
      "今日は天気が変わりやすいですね。",
      "この天気なら、駅まで急いだほうがいいです。",
    ],
    commonCollocations: ["いい天気", "天気が悪い", "天気予報"],
  },
};

export const GRAMMAR_METADATA: Record<string, GrammarMetadata> = {
  "つもり": {
    pattern: "つもり",
    meaning: "intend to / plan to",
    jlptLevel: "N4",
    formation: "Verb dictionary form + つもりです",
    exampleSentences: [
      "日本に行くつもりです。",
      "今日は早く帰るつもりです。",
    ],
    commonMistakes: [
      "行ったつもりです has a different meaning: thought I went / pretended to go.",
    ],
    scenarioTags: ["plans", "weekend", "travel", "promise"],
    activePromptTemplates: [
      "Ask what the learner plans to do after leaving the cafe.",
      "Have the learner explain what they intend to do after arriving in Kyoto.",
    ],
    passiveExampleTemplates: [
      "私は明日、駅に行くつもりです。",
      "彼はその約束を守るつもりらしいです。",
    ],
  },
  "〜てしまう": {
    pattern: "〜てしまう",
    meaning: "to end up doing; to do completely, often with regret",
    jlptLevel: "N4",
    formation: "Verb て-form + しまう / しまいます",
    exampleSentences: [
      "地図を忘れてしまいました。",
      "コーヒーを全部飲んでしまいました。",
    ],
    commonMistakes: [
      "Do not use it for every completed action; it often adds regret, surprise, or completion.",
    ],
    scenarioTags: ["completion", "regret", "cafe", "accident"],
    activePromptTemplates: [
      "Have the learner explain something they accidentally did before reaching the cafe.",
    ],
    passiveExampleTemplates: [
      "大事なメモをなくしてしまったんです。",
      "雨で地図がぬれてしまいました。",
    ],
  },
  "〜たい": {
    pattern: "〜たい",
    meaning: "want to do",
    jlptLevel: "N5",
    formation: "Verb stem + たいです",
    exampleSentences: ["京都を歩きたいです。", "温かいお茶を飲みたいです。"],
    commonMistakes: ["Use が with objects naturally: 水が飲みたいです."],
    scenarioTags: ["desire", "travel", "food"],
    activePromptTemplates: ["Ask what the learner wants to do next."],
    passiveExampleTemplates: ["私はこの地図を見たいです。"],
  },
};

export const GENERIC_DISTRACTORS = [
  "door",
  "street",
  "weather",
  "promise",
  "station",
  "book",
  "quiet",
  "to hurry",
];

export function getVocabMetadata(word: string): VocabMetadata | undefined {
  return VOCAB_METADATA[word];
}

export function getGrammarMetadata(pattern: string): GrammarMetadata | undefined {
  if (GRAMMAR_METADATA[pattern]) return GRAMMAR_METADATA[pattern];
  const normalized = pattern.replace(/[~～]/g, "〜");
  return GRAMMAR_METADATA[normalized] ?? GRAMMAR_METADATA[normalized.replace(/^〜/, "")];
}

export function fallbackMeaning(type: SceneItemType, text: string): string {
  return type === "grammar"
    ? `Use ${text} accurately in context`
    : `Review the meaning and use of ${text}`;
}
