/**
 * Pure, network-free rule-based scorer for the Layer-2 review-quality eval
 * harness (contract-003).
 *
 * Given a `review` object as returned by `POST /api/session/finish` and a
 * single labeled expectation, decide whether the review "caught" the planted
 * issue via substring matching. No network, no LLM, no DB — this is the
 * unit-tested source of truth that `scripts/eval-review.mjs` mirrors.
 *
 * The LLM judge (a second Gemini call) lives in the runner, NOT here: it runs
 * for `fuzzy: true` expectations and as a fallback when a rule-based check
 * misses. Spurious catches (review items matching no expectation) are a SOFT
 * precision signal only — never a hard failure.
 */

export interface ReviewError {
  observed?: string | null;
  expected?: string | null;
  pattern_description?: string | null;
  type?: string | null;
  explanation?: string | null;
  source_message?: string | null;
  severity?: string | null;
}

export interface ReviewUnknownWord {
  word?: string | null;
  context?: string | null;
  definition?: string | null;
}

export interface ReviewGrammarItem {
  pattern?: string | null;
  level?: string | null;
  example?: string | null;
  correct?: boolean;
}

/**
 * The subset of the finish `review` object the scorer reads. Extra fields on
 * the real payload are ignored.
 */
export interface ReviewShape {
  summary?: string;
  errors?: ReviewError[];
  unknownWords?: ReviewUnknownWord[];
  grammarPracticed?: ReviewGrammarItem[];
  vocabularySeen?: string[];
  queuedForLearning?: string[];
}

export interface ErrorExpectation {
  token: string;
  fuzzy?: boolean;
}

export interface MatchResult {
  caught: boolean;
}

function norm(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Substring match that ignores surrounding whitespace on the needle. Empty
 * needles never match (an empty expectation cannot be "caught").
 */
export function tokenMatches(haystack: unknown, needle: string): boolean {
  const n = norm(needle);
  if (!n) return false;
  const h = norm(haystack);
  if (!h) return false;
  return h.includes(n);
}

/**
 * An expected error is caught if its token appears (substring) in ANY review
 * error's `observed`, `expected`, or `pattern_description`.
 */
export function scoreErrorExpectation(
  review: ReviewShape,
  expectation: ErrorExpectation
): MatchResult {
  const token = norm(expectation.token);
  if (!token) return { caught: false };
  const errors = Array.isArray(review.errors) ? review.errors : [];
  const caught = errors.some(
    (err) =>
      tokenMatches(err?.observed, token) ||
      tokenMatches(err?.expected, token) ||
      tokenMatches(err?.pattern_description, token)
  );
  return { caught };
}

/**
 * An expected unknown word is caught if it appears in `unknownWords[].word`,
 * `vocabularySeen[]`, or `queuedForLearning[]`.
 */
export function scoreUnknownExpectation(
  review: ReviewShape,
  word: string
): MatchResult {
  const needle = norm(word);
  if (!needle) return { caught: false };

  const unknownHit = (Array.isArray(review.unknownWords) ? review.unknownWords : [])
    .some((item) => tokenMatches(item?.word, needle));
  const seenHit = (Array.isArray(review.vocabularySeen) ? review.vocabularySeen : [])
    .some((w) => tokenMatches(w, needle));
  const queuedHit = (Array.isArray(review.queuedForLearning) ? review.queuedForLearning : [])
    .some((w) => tokenMatches(w, needle));

  return { caught: unknownHit || seenHit || queuedHit };
}

/**
 * An expected grammar point is caught if it appears (substring) in any
 * `grammarPracticed[].pattern`.
 */
export function scoreGrammarExpectation(
  review: ReviewShape,
  pattern: string
): MatchResult {
  const needle = norm(pattern);
  if (!needle) return { caught: false };
  const grammar = Array.isArray(review.grammarPracticed)
    ? review.grammarPracticed
    : [];
  const caught = grammar.some((item) => tokenMatches(item?.pattern, needle));
  return { caught };
}

export interface ExpectShape {
  errors?: ErrorExpectation[];
  unknownWords?: string[];
  grammar?: string[];
  noErrors?: boolean;
}

export interface SpuriousError {
  observed: string;
  expected: string;
}

/**
 * Review errors that match NONE of the expected error tokens. These are a SOFT
 * precision signal (the LLM may legitimately flag extra real issues) — never a
 * hard failure. On a guard transcript (`noErrors: true` with no planted error
 * tokens) every flagged error is, by definition, spurious.
 */
export function findSpuriousCatches(
  review: ReviewShape,
  expect: ExpectShape
): SpuriousError[] {
  const errors = Array.isArray(review.errors) ? review.errors : [];
  const expectedTokens = (Array.isArray(expect.errors) ? expect.errors : [])
    .map((e) => norm(e?.token))
    .filter((t) => t.length > 0);

  const spurious: SpuriousError[] = [];
  for (const err of errors) {
    const observed = norm(err?.observed);
    const expected = norm(err?.expected);
    const matchesExpectation = expectedTokens.some(
      (token) =>
        tokenMatches(observed, token) ||
        tokenMatches(expected, token) ||
        tokenMatches(err?.pattern_description, token)
    );
    if (!matchesExpectation) {
      spurious.push({ observed, expected });
    }
  }
  return spurious;
}
