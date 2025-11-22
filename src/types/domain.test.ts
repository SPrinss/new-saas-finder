import { describe, it, expect } from "vitest";
import { createKeyword, passesFilters, type Keyword } from "./domain.js";

describe("createKeyword", () => {
  it("should create keyword with defaults", () => {
    const kw = createKeyword({ keyword: "test keyword" });

    expect(kw.keyword).toBe("test keyword");
    expect(kw.monthlyVolume).toBe(0);
    expect(kw.difficultyScore).toBe(0);
    expect(kw.cpc).toBe(0);
    expect(kw.competition).toBe(0);
    expect(kw.competitionLevel).toBeNull();
    expect(kw.intent).toBeNull();
    expect(kw.serpResults).toEqual([]);
    expect(kw.avgCompetitorDa).toBe(0);
    expect(kw.hasOutdatedResults).toBe(false);
    expect(kw.redditFrustrationCount).toBe(0);
    expect(kw.redditSampleQuotes).toEqual([]);
  });

  it("should create keyword with provided values", () => {
    const kw = createKeyword({
      keyword: "json formatter",
      monthlyVolume: 22000,
      difficultyScore: 25,
      cpc: 2.5,
      competition: 0.15,
      competitionLevel: "LOW",
      intent: "transactional",
    });

    expect(kw.keyword).toBe("json formatter");
    expect(kw.monthlyVolume).toBe(22000);
    expect(kw.difficultyScore).toBe(25);
    expect(kw.cpc).toBe(2.5);
    expect(kw.competition).toBe(0.15);
    expect(kw.competitionLevel).toBe("LOW");
    expect(kw.intent).toBe("transactional");
  });
});

describe("passesFilters", () => {
  const createTestKeyword = (overrides: Partial<Keyword> = {}): Keyword =>
    createKeyword({
      keyword: "test",
      monthlyVolume: 5000,
      difficultyScore: 20,
      cpc: 2.0,
      ...overrides,
    });

  it("should pass with default filters when keyword meets criteria", () => {
    const kw = createTestKeyword();
    expect(passesFilters(kw)).toBe(true);
  });

  it("should fail when volume is below minimum", () => {
    const kw = createTestKeyword({ monthlyVolume: 500 });
    expect(passesFilters(kw)).toBe(false);
  });

  it("should fail when volume is above maximum", () => {
    const kw = createTestKeyword({ monthlyVolume: 100000 });
    expect(passesFilters(kw)).toBe(false);
  });

  it("should fail when difficulty is above maximum", () => {
    const kw = createTestKeyword({ difficultyScore: 50 });
    expect(passesFilters(kw)).toBe(false);
  });

  it("should fail when CPC is below minimum", () => {
    const kw = createTestKeyword({ cpc: 0.5 });
    expect(passesFilters(kw)).toBe(false);
  });

  it("should use custom filter values", () => {
    const kw = createTestKeyword({
      monthlyVolume: 500,
      difficultyScore: 40,
      cpc: 0.5,
    });

    expect(
      passesFilters(kw, {
        minVolume: 100,
        maxVolume: 1000,
        maxDifficulty: 50,
        minCpc: 0.1,
      })
    ).toBe(true);
  });

  it("should pass at exact boundary values", () => {
    const kw = createTestKeyword({
      monthlyVolume: 1000, // exact minimum
      difficultyScore: 30, // exact maximum
      cpc: 1.0, // exact minimum
    });

    expect(passesFilters(kw)).toBe(true);
  });
});
