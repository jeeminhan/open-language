import type { CurriculumLessonPlan } from "./types";

const attribution = [
  {
    source: "jmdict",
    label: "JMdict",
    license: "CC BY-SA 4.0",
    url: "https://www.edrdg.org/jmdict/edict_doc.html",
  },
  {
    source: "jpdb",
    label: "JPDB frequency list",
    license: "freely downloadable, attribution required",
    url: "https://jpdb.io",
  },
  {
    source: "authored",
    label: "open-language JLPT grammar skeleton",
    license: "CC BY 4.0",
    url: "/about/data",
  },
];

export function buildFallbackJapaneseLessonPlan({
  scenarioId = "koenji-coffee-shop",
  scenarioLabel = "Koenji coffee shop",
  scenarioTags = ["food", "polite", "transactional", "everyday"],
}: {
  scenarioId?: string;
  scenarioLabel?: string;
  scenarioTags?: string[];
} = {}): CurriculumLessonPlan {
  return {
    snapshotId: null,
    scenarioId,
    scenarioLabel,
    scenarioTags,
    explanation:
      "Starter JP plan while the active curriculum snapshot is unavailable.",
    fallback: true,
    attribution,
    vocab: [
      {
        id: "fallback-ja-vocab-okaikei",
        headword: "お会計",
        primaryReading: "おかいけい",
        gloss: "the bill or checkout",
        frequencyRank: 871,
        jlptLevel: "N4",
        tags: ["food", "transactional", "polite"],
        attribution: "JMdict + JPDB",
      },
      {
        id: "fallback-ja-vocab-okawari",
        headword: "おかわり",
        primaryReading: "おかわり",
        gloss: "another serving or refill",
        frequencyRank: 1940,
        jlptLevel: "N4",
        tags: ["food", "transactional"],
        attribution: "JMdict + JPDB",
      },
      {
        id: "fallback-ja-vocab-cup",
        headword: "カップ",
        primaryReading: "カップ",
        gloss: "cup",
        frequencyRank: 2184,
        jlptLevel: "N5",
        tags: ["food", "objects", "everyday"],
        attribution: "JMdict + JPDB",
      },
      {
        id: "fallback-ja-vocab-joren",
        headword: "常連",
        primaryReading: "じょうれん",
        gloss: "a regular customer",
        frequencyRank: 3402,
        jlptLevel: "N3",
        tags: ["people", "everyday"],
        attribution: "JMdict + JPDB",
      },
      {
        id: "fallback-ja-vocab-ice-less",
        headword: "アイス少なめ",
        primaryReading: "アイスすくなめ",
        gloss: "less ice",
        frequencyRank: null,
        jlptLevel: "N4",
        tags: ["food", "preference", "transactional"],
        attribution: "authored phrase",
      },
    ],
    grammar: [
      {
        id: "fallback-ja-grammar-te-shimau",
        name: "〜てしまう",
        romaji: "-te shimau",
        jlptLevel: "N4",
        gloss:
          "Use it when something ends up happening completely, often with a small sigh attached.",
        tags: ["verb-form", "completion", "regret", "casual"],
        attribution: "open-language authored skeleton",
      },
    ],
  };
}
