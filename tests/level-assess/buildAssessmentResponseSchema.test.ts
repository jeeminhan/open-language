import { describe, expect, it } from "vitest";
import { buildAssessmentResponseSchema, CEFR_LEVELS } from "@/lib/levelAssess";

describe("buildAssessmentResponseSchema", () => {
  const schema = buildAssessmentResponseSchema();

  it("describes an object with the three required fields", () => {
    expect(schema.type).toBe("OBJECT");
    expect(schema.required).toEqual(["level", "justification", "seedWords"]);
  });

  it("pins level to a STRING enum of the valid CEFR levels", () => {
    const level = schema.properties.level;
    expect(level.type).toBe("STRING");
    expect([...level.enum]).toEqual([...CEFR_LEVELS]);
  });

  it("types justification as a STRING", () => {
    expect(schema.properties.justification.type).toBe("STRING");
  });

  it("types seedWords as an ARRAY of STRING items", () => {
    const seedWords = schema.properties.seedWords;
    expect(seedWords.type).toBe("ARRAY");
    expect(seedWords.items.type).toBe("STRING");
  });
});
