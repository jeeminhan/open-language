import { describe, expect, it } from "vitest";
import { toClientPayload, type NormalizedAssessment } from "@/lib/levelAssess";

const realAssessment: NormalizedAssessment = {
  level: "B1",
  justification: "Handled past tense well; some particle slips.",
  seedWords: ["常連"],
};

describe("toClientPayload", () => {
  it("clears assessmentFailed on the success path", () => {
    const payload = toClientPayload(realAssessment, null);
    expect(payload.assessmentFailed).toBe(false);
    expect(payload.debug).toBeNull();
    expect(payload.level).toBe("B1");
    expect(payload.justification).toBe(realAssessment.justification);
    expect(payload.seedWords).toEqual(["常連"]);
  });

  it("sets assessmentFailed and carries debug on the degraded path", () => {
    const fallback: NormalizedAssessment = {
      level: "A2",
      justification: "Default placement — assessment unavailable.",
      seedWords: [],
    };
    const payload = toClientPayload(fallback, "LLM HTTP 400: bad key");
    expect(payload.assessmentFailed).toBe(true);
    expect(payload.debug).toBe("LLM HTTP 400: bad key");
    expect(payload.level).toBe("A2");
  });

  it("treats an empty-string error as a failure (non-null)", () => {
    const payload = toClientPayload(realAssessment, "");
    expect(payload.assessmentFailed).toBe(true);
    expect(payload.debug).toBe("");
  });
});
