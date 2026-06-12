import { describe, expect, it } from "vitest";
import { hasTargetScript, isValidLevel, normalizeAssessment } from "@/lib/levelAssess";

describe("isValidLevel", () => {
  it("accepts all six CEFR levels", () => {
    for (const l of ["A1", "A2", "B1", "B2", "C1", "C2"]) {
      expect(isValidLevel(l)).toBe(true);
    }
  });

  it("rejects junk", () => {
    expect(isValidLevel("N5")).toBe(false);
    expect(isValidLevel("b1")).toBe(false);
    expect(isValidLevel(2)).toBe(false);
    expect(isValidLevel(null)).toBe(false);
  });
});

describe("hasTargetScript", () => {
  it("detects Japanese script", () => {
    expect(hasTargetScript("柿", "Japanese")).toBe(true);
    expect(hasTargetScript("おかわり", "Japanese")).toBe(true);
    expect(hasTargetScript("persimmon", "Japanese")).toBe(false);
  });

  it("detects English", () => {
    expect(hasTargetScript("persimmon", "English")).toBe(true);
    expect(hasTargetScript("柿", "English")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(hasTargetScript("", "Japanese")).toBe(false);
  });
});

describe("normalizeAssessment", () => {
  it("passes through a valid payload", () => {
    const out = normalizeAssessment(
      { level: "B2", justification: "Solid past tense.", seedWords: ["常連", "おかわり"] },
      "Japanese"
    );
    expect(out).toEqual({
      level: "B2",
      justification: "Solid past tense.",
      seedWords: ["常連", "おかわり"],
    });
  });

  it("falls back to A2 for an invalid level", () => {
    expect(normalizeAssessment({ level: "Z9" }, "Japanese").level).toBe("A2");
  });

  it("drops seed words not in the target script", () => {
    const out = normalizeAssessment(
      { level: "B1", seedWords: ["柿", "persimmon", "  ", 42] },
      "Japanese"
    );
    expect(out.seedWords).toEqual(["柿"]);
  });

  it("caps seed words at 5", () => {
    const words = ["一", "二", "三", "四", "五", "六", "七"];
    const out = normalizeAssessment({ level: "B1", seedWords: words }, "Japanese");
    expect(out.seedWords).toHaveLength(5);
  });

  it("survives a null payload", () => {
    const out = normalizeAssessment(null, "Japanese");
    expect(out.level).toBe("A2");
    expect(out.seedWords).toEqual([]);
    expect(out.justification.length).toBeGreaterThan(0);
  });
});
