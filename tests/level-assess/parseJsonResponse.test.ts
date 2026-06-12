import { describe, expect, it } from "vitest";
import { parseJsonResponse } from "@/lib/levelAssess";

const VALID = { level: "B1", justification: "ok", seedWords: ["柿"] };

describe("parseJsonResponse", () => {
  it("parses plain JSON", () => {
    expect(parseJsonResponse(JSON.stringify(VALID))).toEqual(VALID);
  });

  it("strips ```json fences", () => {
    const raw = "```json\n" + JSON.stringify(VALID) + "\n```";
    expect(parseJsonResponse(raw)).toEqual(VALID);
  });

  it("strips bare ``` fences", () => {
    const raw = "```\n" + JSON.stringify(VALID) + "\n```";
    expect(parseJsonResponse(raw)).toEqual(VALID);
  });

  it("extracts JSON wrapped in prose", () => {
    const raw =
      "Here is my assessment of the learner:\n" +
      JSON.stringify(VALID) +
      "\nLet me know if you need anything else.";
    expect(parseJsonResponse(raw)).toEqual(VALID);
  });

  it("tolerates trailing commas", () => {
    const raw = '{"level": "A2", "justification": "ok", "seedWords": ["柿",],}';
    expect(parseJsonResponse(raw)).toEqual({
      level: "A2",
      justification: "ok",
      seedWords: ["柿"],
    });
  });

  it("returns null for JSON truncated mid-object (the maxOutputTokens bug)", () => {
    // Regression fixture: gemini-2.5-flash thinking tokens exhausted the output
    // budget and the JSON arrived cut off. This must fail loudly (null), never
    // half-parse.
    const truncated = '{"level": "B1", "justification": "Handles past tense well but strug';
    expect(parseJsonResponse(truncated)).toBeNull();
  });

  it("returns null for an empty response", () => {
    expect(parseJsonResponse("")).toBeNull();
  });

  it("returns null for pure prose with no JSON", () => {
    expect(parseJsonResponse("The learner seems to be intermediate.")).toBeNull();
  });
});
