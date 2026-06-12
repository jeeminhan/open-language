import { describe, expect, it } from "vitest";
import {
  LEVEL_TEST_EXCHANGE_CAP,
  shouldEndLevelTest,
} from "@/lib/levelAssess";

describe("shouldEndLevelTest", () => {
  it("returns false for counts 0–4 with the default cap", () => {
    for (let count = 0; count < LEVEL_TEST_EXCHANGE_CAP; count++) {
      expect(shouldEndLevelTest(count)).toBe(false);
    }
  });

  it("returns true at the default cap and above", () => {
    expect(shouldEndLevelTest(5)).toBe(true);
    expect(shouldEndLevelTest(6)).toBe(true);
    expect(shouldEndLevelTest(100)).toBe(true);
  });

  it("uses 5 as the default cap", () => {
    expect(LEVEL_TEST_EXCHANGE_CAP).toBe(5);
    expect(shouldEndLevelTest(4)).toBe(false);
    expect(shouldEndLevelTest(5)).toBe(true);
  });

  it("respects an explicit cap argument", () => {
    expect(shouldEndLevelTest(2, 3)).toBe(false);
    expect(shouldEndLevelTest(3, 3)).toBe(true);
    expect(shouldEndLevelTest(6, 7)).toBe(false);
    expect(shouldEndLevelTest(7, 7)).toBe(true);
  });
});
