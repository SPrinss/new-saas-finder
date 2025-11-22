import { describe, it, expect, vi, beforeEach } from "vitest";
import { NicheScorer, scoringFunctions } from "./scorer.js";
import { createKeyword, type Keyword } from "../types/domain.js";

// Mock Anthropic
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              score: 7.5,
              reasoning: "Good opportunity with low competition",
            }),
          },
        ],
        usage: {
          input_tokens: 75,
          output_tokens: 75,
        },
      }),
    },
  })),
}));

describe("NicheScorer", () => {
  describe("rule-based scoring", () => {
    let scorer: NicheScorer;

    beforeEach(() => {
      scorer = new NicheScorer({ useAI: false });
    });

    it("should score keywords without AI", async () => {
      const keyword = createKeyword({
        keyword: "json formatter online",
        monthlyVolume: 8000,
        difficultyScore: 20,
        cpc: 2.5,
        avgCompetitorDa: 35,
      });

      const opportunities = await scorer.scoreKeywords([keyword], () => {});

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].opportunityScore).toBeGreaterThan(0);
      expect(opportunities[0].aiReasoning).toBe("Rule-based scoring only");
    });

    it("should sort by opportunity score descending", async () => {
      const keywords = [
        createKeyword({
          keyword: "low opportunity",
          difficultyScore: 80,
          cpc: 0.5,
        }),
        createKeyword({
          keyword: "high opportunity",
          difficultyScore: 10,
          cpc: 5.0,
        }),
      ];

      const opportunities = await scorer.scoreKeywords(keywords, () => {});

      expect(opportunities[0].keyword.keyword).toBe("high opportunity");
      expect(opportunities[1].keyword.keyword).toBe("low opportunity");
    });
  });

  describe("with AI scoring", () => {
    it("should blend AI and rule-based scores", async () => {
      const scorer = new NicheScorer({
        useAI: true,
        anthropicApiKey: "test-key",
      });

      const keyword = createKeyword({
        keyword: "test keyword",
        monthlyVolume: 5000,
        difficultyScore: 25,
        cpc: 2.0,
      });

      const opportunities = await scorer.scoreKeywords([keyword], () => {});

      expect(opportunities[0].aiReasoning).toBe("Good opportunity with low competition");
      expect(opportunities[0].opportunityScore).toBeGreaterThan(0);
    });

    it("should track token usage", async () => {
      const scorer = new NicheScorer({
        useAI: true,
        anthropicApiKey: "test-key",
      });

      const keyword = createKeyword({ keyword: "test" });
      await scorer.scoreKeywords([keyword], () => {});

      expect(scorer.totalTokens).toBe(150);
      expect(scorer.getCostEstimate()).toBeGreaterThan(0);
    });
  });
});

describe("scoringFunctions", () => {
  describe("competition score", () => {
    it("should give high score for low difficulty and low DA", () => {
      const kw = createKeyword({
        keyword: "test",
        difficultyScore: 10,
        avgCompetitorDa: 20,
      });

      const score = scoringFunctions.competition(kw);
      expect(score).toBeGreaterThan(7);
    });

    it("should give low score for high difficulty and high DA", () => {
      const kw = createKeyword({
        keyword: "test",
        difficultyScore: 80,
        avgCompetitorDa: 90,
      });

      const score = scoringFunctions.competition(kw);
      expect(score).toBeLessThan(3);
    });
  });

  describe("intent score", () => {
    it("should give high score for tool-related keywords", () => {
      const kw = createKeyword({
        keyword: "free online json formatter generator",
        intent: "transactional",
      });

      const score = scoringFunctions.intent(kw);
      expect(score).toBeGreaterThan(7);
    });

    it("should give bonus for transactional intent", () => {
      const kwWithIntent = createKeyword({
        keyword: "test tool",
        intent: "transactional",
      });
      const kwWithoutIntent = createKeyword({
        keyword: "test tool",
        intent: null,
      });

      const scoreWith = scoringFunctions.intent(kwWithIntent);
      const scoreWithout = scoringFunctions.intent(kwWithoutIntent);

      expect(scoreWith).toBeGreaterThan(scoreWithout);
    });

    it("should give lower score for non-tool keywords", () => {
      const kw = createKeyword({
        keyword: "javascript tutorial",
        intent: "informational",
      });

      const score = scoringFunctions.intent(kw);
      expect(score).toBeLessThan(5);
    });
  });

  describe("commercial score", () => {
    it("should scale with CPC", () => {
      const lowCpc = createKeyword({ keyword: "test", cpc: 0.5 });
      const highCpc = createKeyword({ keyword: "test", cpc: 5.0 });

      const lowScore = scoringFunctions.commercial(lowCpc);
      const highScore = scoringFunctions.commercial(highCpc);

      expect(highScore).toBeGreaterThan(lowScore);
      expect(highScore).toBe(10); // Capped at 10
    });
  });

  describe("frustration score", () => {
    it("should scale with Reddit frustration count", () => {
      const lowFrustration = createKeyword({
        keyword: "test",
        redditFrustrationCount: 1,
      });
      const highFrustration = createKeyword({
        keyword: "test",
        redditFrustrationCount: 10,
      });

      const lowScore = scoringFunctions.frustration(lowFrustration);
      const highScore = scoringFunctions.frustration(highFrustration);

      expect(highScore).toBeGreaterThan(lowScore);
      expect(highScore).toBe(10); // Capped at 10
    });
  });
});
