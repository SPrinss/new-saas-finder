import { describe, it, expect, vi, beforeEach } from "vitest";
import { TrendDiscovery, type TrendingKeyword } from "./trend-discovery.js";
import { DataForSEOClient } from "../clients/dataforseo.js";

describe("TrendDiscovery", () => {
  let client: DataForSEOClient;
  let mockFetch: ReturnType<typeof vi.fn>;
  let discovery: TrendDiscovery;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new DataForSEOClient({
      login: "test",
      password: "test",
      maxBudget: 100,
    });
    client.fetchFn = mockFetch;
    discovery = new TrendDiscovery(client);
  });

  describe("generateCandidates", () => {
    it("should generate pattern-based keywords", () => {
      const customDiscovery = new TrendDiscovery(client, {
        patterns: {
          verbs: ["convert", "generate"],
          objects: ["image", "pdf"],
        },
      });

      const candidates = customDiscovery["generateCandidates"]();

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates).toContain("convert image");
      expect(candidates).toContain("image convert");
      expect(candidates).toContain("convert image online");
    });

    it("should include AI variants", () => {
      const candidates = discovery["generateCandidates"]();

      const aiKeywords = candidates.filter((k) => k.includes("ai"));
      expect(aiKeywords.length).toBeGreaterThan(0);
    });
  });

  describe("analyzeTrend", () => {
    it("should detect robust growth pattern", () => {
      const data = {
        keyword: "ai image generator",
        currentVolume: 5000,
        cpc: 2.5,
        competition: 0.3,
        competitionLevel: "MEDIUM" as const,
        difficulty: 25,
        intent: "transactional" as const,
        monthlySearches: [
          { year: 2023, month: 12, search_volume: 1000 },
          { year: 2024, month: 1, search_volume: 1200 },
          { year: 2024, month: 2, search_volume: 1500 },
          { year: 2024, month: 3, search_volume: 1800 },
          { year: 2024, month: 4, search_volume: 2200 },
          { year: 2024, month: 5, search_volume: 2700 },
          { year: 2024, month: 6, search_volume: 3200 },
          { year: 2024, month: 7, search_volume: 3800 },
          { year: 2024, month: 8, search_volume: 4200 },
          { year: 2024, month: 9, search_volume: 4600 },
          { year: 2024, month: 10, search_volume: 4800 },
          { year: 2024, month: 11, search_volume: 5000 },
        ],
      };

      const result = discovery["analyzeTrend"](data);

      expect(result.trendSignals.pattern).toBe("robust");
      expect(result.trendSignals.yearlyGrowth).toBeGreaterThan(300); // 400% growth
      expect(result.trendSignals.quarterlyGrowth).toBeGreaterThan(0);
    });

    it("should detect spike pattern", () => {
      const data = {
        keyword: "wordle clone",
        currentVolume: 500,
        cpc: 0.5,
        competition: 0.1,
        competitionLevel: "LOW" as const,
        difficulty: 10,
        intent: "informational" as const,
        monthlySearches: [
          { year: 2023, month: 12, search_volume: 200 },
          { year: 2024, month: 1, search_volume: 300 },
          { year: 2024, month: 2, search_volume: 15000 }, // Spike!
          { year: 2024, month: 3, search_volume: 8000 },
          { year: 2024, month: 4, search_volume: 3000 },
          { year: 2024, month: 5, search_volume: 1200 },
          { year: 2024, month: 6, search_volume: 800 },
          { year: 2024, month: 7, search_volume: 600 },
          { year: 2024, month: 8, search_volume: 550 },
          { year: 2024, month: 9, search_volume: 520 },
          { year: 2024, month: 10, search_volume: 510 },
          { year: 2024, month: 11, search_volume: 500 },
        ],
      };

      const result = discovery["analyzeTrend"](data);

      expect(result.trendSignals.pattern).toBe("spike");
    });

    it("should detect declining pattern", () => {
      const data = {
        keyword: "nft generator",
        currentVolume: 1200,
        cpc: 0.4,
        competition: 0.1,
        competitionLevel: "LOW" as const,
        difficulty: 15,
        intent: "transactional" as const,
        monthlySearches: [
          { year: 2023, month: 12, search_volume: 14000 },
          { year: 2024, month: 1, search_volume: 12000 },
          { year: 2024, month: 2, search_volume: 9000 },
          { year: 2024, month: 3, search_volume: 6000 },
          { year: 2024, month: 4, search_volume: 4000 },
          { year: 2024, month: 5, search_volume: 3000 },
          { year: 2024, month: 6, search_volume: 2200 },
          { year: 2024, month: 7, search_volume: 1800 },
          { year: 2024, month: 8, search_volume: 1500 },
          { year: 2024, month: 9, search_volume: 1400 },
          { year: 2024, month: 10, search_volume: 1300 },
          { year: 2024, month: 11, search_volume: 1200 },
        ],
      };

      const result = discovery["analyzeTrend"](data);

      expect(result.trendSignals.pattern).toBe("declining");
      expect(result.trendSignals.yearlyGrowth).toBeLessThan(0);
    });
  });

  describe("isRising", () => {
    it("should filter robust growth keywords", () => {
      const robustKeyword: TrendingKeyword = {
        keyword: "ai tool",
        monthlyVolume: 5000,
        difficultyScore: 20,
        cpc: 2.0,
        competition: 0.2,
        competitionLevel: "LOW",
        intent: "transactional",
        serpResults: [],
        avgCompetitorDa: 0,
        hasOutdatedResults: false,
        redditFrustrationCount: 0,
        redditSampleQuotes: [],
        trendSignals: {
          monthlyGrowth: 15,
          quarterlyGrowth: 60,
          yearlyGrowth: 200,
          pattern: "robust",
          volumeHistory: [],
        },
      };

      expect(discovery["isRising"](robustKeyword)).toBe(true);
    });

    it("should reject declining keywords", () => {
      const decliningKeyword: TrendingKeyword = {
        keyword: "old trend",
        monthlyVolume: 5000,
        difficultyScore: 20,
        cpc: 2.0,
        competition: 0.2,
        competitionLevel: "LOW",
        intent: "transactional",
        serpResults: [],
        avgCompetitorDa: 0,
        hasOutdatedResults: false,
        redditFrustrationCount: 0,
        redditSampleQuotes: [],
        trendSignals: {
          monthlyGrowth: -20,
          quarterlyGrowth: -50,
          yearlyGrowth: -80,
          pattern: "declining",
          volumeHistory: [],
        },
      };

      expect(discovery["isRising"](decliningKeyword)).toBe(false);
    });

    it("should reject spikes when requireRobustGrowth is true", () => {
      const spikeKeyword: TrendingKeyword = {
        keyword: "fad tool",
        monthlyVolume: 5000,
        difficultyScore: 20,
        cpc: 2.0,
        competition: 0.2,
        competitionLevel: "LOW",
        intent: "transactional",
        serpResults: [],
        avgCompetitorDa: 0,
        hasOutdatedResults: false,
        redditFrustrationCount: 0,
        redditSampleQuotes: [],
        trendSignals: {
          monthlyGrowth: 300,
          quarterlyGrowth: 500,
          yearlyGrowth: 1000,
          pattern: "spike",
          volumeHistory: [],
        },
      };

      expect(discovery["isRising"](spikeKeyword)).toBe(false);
    });

    it("should respect volume constraints", () => {
      const tooSmall: TrendingKeyword = {
        keyword: "tiny trend",
        monthlyVolume: 500, // Below 1000 minimum
        difficultyScore: 5,
        cpc: 3.0,
        competition: 0.1,
        competitionLevel: "LOW",
        intent: "transactional",
        serpResults: [],
        avgCompetitorDa: 0,
        hasOutdatedResults: false,
        redditFrustrationCount: 0,
        redditSampleQuotes: [],
        trendSignals: {
          monthlyGrowth: 50,
          quarterlyGrowth: 150,
          yearlyGrowth: 400,
          pattern: "robust",
          volumeHistory: [],
        },
      };

      expect(discovery["isRising"](tooSmall)).toBe(false);
    });
  });

  describe("calcGrowth", () => {
    it("should calculate growth percentage correctly", () => {
      const growth = discovery["calcGrowth"](1000, 1500);
      expect(growth).toBe(50);
    });

    it("should handle zero baseline", () => {
      const growth = discovery["calcGrowth"](0, 1000);
      expect(growth).toBe(1000);
    });

    it("should handle negative growth", () => {
      const growth = discovery["calcGrowth"](2000, 1000);
      expect(growth).toBe(-50);
    });
  });
});
