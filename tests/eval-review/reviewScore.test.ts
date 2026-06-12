import { describe, expect, it } from "vitest";
import {
  findSpuriousCatches,
  scoreErrorExpectation,
  scoreGrammarExpectation,
  scoreUnknownExpectation,
  tokenMatches,
  type ReviewShape,
} from "@/lib/reviewScore";

// Build a fixture `review` inline — no network, no LLM, no live DB.
function review(partial: Partial<ReviewShape>): ReviewShape {
  return {
    summary: "test",
    errors: [],
    unknownWords: [],
    grammarPracticed: [],
    vocabularySeen: [],
    queuedForLearning: [],
    ...partial,
  };
}

describe("scoreErrorExpectation", () => {
  it("(a) catches an error token present in errors[].expected", () => {
    const r = review({
      errors: [
        { observed: "良き", expected: "よく", pattern_description: "adjective adverbial form" },
      ],
    });
    expect(scoreErrorExpectation(r, { token: "よく" }).caught).toBe(true);
  });

  it("catches via observed and via pattern_description", () => {
    const observedHit = review({ errors: [{ observed: "公園が散歩しました", expected: "公園を" }] });
    expect(scoreErrorExpectation(observedHit, { token: "が" }).caught).toBe(true);

    const patternHit = review({
      errors: [{ observed: "x", expected: "y", pattern_description: "は vs が subject marking" }],
    });
    expect(scoreErrorExpectation(patternHit, { token: "は vs が" }).caught).toBe(true);
  });

  it("(b) reports an absent token as missed", () => {
    const r = review({ errors: [{ observed: "良き", expected: "よく" }] });
    expect(scoreErrorExpectation(r, { token: "ご覧になる" }).caught).toBe(false);
  });

  it("misses against an empty errors array and an empty token", () => {
    expect(scoreErrorExpectation(review({}), { token: "が" }).caught).toBe(false);
    expect(
      scoreErrorExpectation(review({ errors: [{ observed: "x", expected: "y" }] }), {
        token: "   ",
      }).caught
    ).toBe(false);
  });
});

describe("scoreUnknownExpectation", () => {
  it("(c) catches an unknown word present in unknownWords[].word", () => {
    const r = review({ unknownWords: [{ word: "渋滞", definition: "traffic jam" }] });
    expect(scoreUnknownExpectation(r, "渋滞").caught).toBe(true);
  });

  it("(c) catches via vocabularySeen and via queuedForLearning", () => {
    expect(scoreUnknownExpectation(review({ vocabularySeen: ["渋滞"] }), "渋滞").caught).toBe(true);
    expect(
      scoreUnknownExpectation(review({ queuedForLearning: ["渋滞"] }), "渋滞").caught
    ).toBe(true);
  });

  it("reports an absent unknown word as missed", () => {
    const r = review({ unknownWords: [{ word: "散歩" }] });
    expect(scoreUnknownExpectation(r, "渋滞").caught).toBe(false);
  });
});

describe("scoreGrammarExpectation", () => {
  it("(d) catches a grammar pattern present in grammarPracticed[].pattern", () => {
    const r = review({
      grammarPracticed: [{ pattern: "て-form request (てください)", correct: true }],
    });
    expect(scoreGrammarExpectation(r, "て-form").caught).toBe(true);
  });

  it("reports an absent grammar pattern as missed", () => {
    const r = review({ grammarPracticed: [{ pattern: "past tense ました" }] });
    expect(scoreGrammarExpectation(r, "て-form").caught).toBe(false);
  });
});

describe("findSpuriousCatches", () => {
  it("(e) flags a review error matching no expectation", () => {
    const r = review({
      errors: [
        { observed: "良き", expected: "よく" }, // matches expectation
        { observed: "コンビニ", expected: "コンビニエンスストア" }, // spurious
      ],
    });
    const spurious = findSpuriousCatches(r, { errors: [{ token: "よく" }] });
    expect(spurious).toHaveLength(1);
    expect(spurious[0].observed).toBe("コンビニ");
  });

  it("treats every flagged error on a guard transcript (no planted tokens) as spurious", () => {
    const r = review({ errors: [{ observed: "アルバイト", expected: "パート" }] });
    const spurious = findSpuriousCatches(r, { noErrors: true });
    expect(spurious).toHaveLength(1);
  });

  it("returns an empty list when every error matches an expectation", () => {
    const r = review({ errors: [{ observed: "良き", expected: "よく" }] });
    expect(findSpuriousCatches(r, { errors: [{ token: "よく" }] })).toHaveLength(0);
  });
});

describe("tokenMatches", () => {
  it("ignores surrounding whitespace and rejects empty needles", () => {
    expect(tokenMatches("  よく ", "よく")).toBe(true);
    expect(tokenMatches("よく", "  ")).toBe(false);
    expect(tokenMatches(null, "よく")).toBe(false);
  });
});
