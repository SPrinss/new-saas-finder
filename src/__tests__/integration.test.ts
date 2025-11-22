/**
 * Integration tests for the SEO Niche Discovery pipeline
 * These tests use mocked API responses to test the full flow
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DataForSEOClient } from "../clients/dataforseo.js";
import { KeywordDiscovery } from "../modules/keyword-discovery.js";
import { SerpAnalyzer } from "../modules/serp-analyzer.js";
import { NicheScorer } from "../modules/scorer.js";
import {
  mockRelatedKeywordsResponse,
  mockSerpResponse,
  mockBacklinksSummaryResponse,
} from "../__mocks__/dataforseo-responses.js";

// Mock OpenAI for integration tests
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  score: 7.5,
                  reasoning: "Good opportunity with low competition and tool-based intent",
                }),
              },
            },
          ],
          usage: { total_tokens: 150 },
        }),
      },
    },
  })),
}));

describe("Pipeline Integration", () => {
  let client: DataForSEOClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new DataForSEOClient({
      login: "test",
      password: "test",
      maxBudget: 100,
    });
    client.fetchFn = mockFetch;
  });

  it("should complete full discovery -> analysis -> scoring flow", async () => {
    // Setup mock responses
    mockFetch
      // Keyword discovery
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRelatedKeywordsResponse),
      })
      // SERP analysis
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSerpResponse),
      })
      // Domain metrics (3 calls for top 3 domains)
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockBacklinksSummaryResponse),
      });

    const messages: string[] = [];
    const log = (msg: string) => messages.push(msg);

    // Step 1: Keyword Discovery
    const discovery = new KeywordDiscovery(client, {
      filters: {
        minVolume: 1000,
        maxVolume: 50000,
        maxDifficulty: 30,
        minCpc: 1.0,
      },
      delayMs: 0,
    });

    const keywords = await discovery.expandSeedKeywords(["json formatter"], log);
    expect(keywords.length).toBeGreaterThan(0);

    // Step 2: SERP Analysis
    const serpAnalyzer = new SerpAnalyzer(client, {
      maxSerpAnalyses: 10,
      maxDomainMetricsPerKeyword: 3,
      delayMs: 0,
    });

    const analyzedKeywords = await serpAnalyzer.analyzeKeywords(
      keywords.slice(0, 1),
      log
    );
    expect(analyzedKeywords.length).toBe(1);
    expect(analyzedKeywords[0].serpResults.length).toBeGreaterThan(0);

    // Step 3: Scoring
    const scorer = new NicheScorer({ useAI: true, anthropicApiKey: "test-key" });
    const opportunities = await scorer.scoreKeywords(analyzedKeywords, log);

    expect(opportunities.length).toBe(1);
    expect(opportunities[0].opportunityScore).toBeGreaterThan(0);
    expect(opportunities[0].aiReasoning).toBeTruthy();
  });

  it("should track costs across all operations", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRelatedKeywordsResponse),
    });

    const discovery = new KeywordDiscovery(client, { delayMs: 0 });
    await discovery.expandSeedKeywords(["test1", "test2"], () => {});

    // Should have made 2 requests for keyword discovery
    expect(client.costTracker.requestsMade).toBe(2);
    expect(client.costTracker.totalSpent).toBeCloseTo(0.002);
  });

  it("should respect budget limits", async () => {
    const tightBudgetClient = new DataForSEOClient({
      login: "test",
      password: "test",
      maxBudget: 0.001, // Very tight budget - only allows 1 request
    });
    tightBudgetClient.fetchFn = mockFetch;

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockRelatedKeywordsResponse),
    });

    const discovery = new KeywordDiscovery(tightBudgetClient, { delayMs: 0 });
    const messages: string[] = [];

    // First request should succeed
    await discovery.expandSeedKeywords(["test1"], (msg) => messages.push(msg));

    // Reset mock call count
    mockFetch.mockClear();

    // Second request should fail due to budget - but module handles gracefully
    await discovery.expandSeedKeywords(["test2"], (msg) => messages.push(msg));

    // Should have logged a budget error and not made any API calls
    expect(messages.some((m) => m.includes("Budget exceeded"))).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should filter keywords based on criteria", async () => {
    // Mock response with keywords that don't meet filter criteria
    const lowQualityResponse = {
      ...mockRelatedKeywordsResponse,
      tasks: [
        {
          ...mockRelatedKeywordsResponse.tasks[0],
          result: [
            {
              ...mockRelatedKeywordsResponse.tasks[0].result![0],
              items: [
                {
                  se_type: "google",
                  keyword_data: {
                    se_type: "google",
                    keyword: "low volume keyword",
                    keyword_info: {
                      se_type: "google",
                      last_updated_time: "2024-10-15",
                      competition: 0.1,
                      competition_level: "LOW" as const,
                      cpc: 0.5, // Below min CPC
                      search_volume: 100, // Below min volume
                      low_top_of_page_bid: 0.1,
                      high_top_of_page_bid: 0.8,
                      categories: null,
                      monthly_searches: null,
                      search_volume_trend: null,
                    },
                    keyword_properties: {
                      se_type: "google",
                      core_keyword: "test",
                      synonym_clustering_algorithm: "text_processing",
                      keyword_difficulty: 5,
                      detected_language: "en",
                      is_another_language: false,
                    },
                    serp_info: null,
                    search_intent_info: null,
                  },
                  depth: 1,
                  related_keywords: null,
                },
              ],
            },
          ],
        },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(lowQualityResponse),
    });

    const discovery = new KeywordDiscovery(client, {
      filters: {
        minVolume: 1000,
        maxVolume: 50000,
        maxDifficulty: 30,
        minCpc: 1.0,
      },
      delayMs: 0,
    });

    const keywords = await discovery.expandSeedKeywords(["test"], () => {});

    // All keywords should be filtered out
    expect(keywords.length).toBe(0);
  });
});

describe("Error Handling Integration", () => {
  let client: DataForSEOClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new DataForSEOClient({
      login: "test",
      password: "test",
      maxBudget: 100,
    });
    client.fetchFn = mockFetch;
  });

  it("should continue processing after individual API failures", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("Network error")) // First seed fails
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRelatedKeywordsResponse),
      }); // Second seed succeeds

    const discovery = new KeywordDiscovery(client, { delayMs: 0 });
    const messages: string[] = [];

    const keywords = await discovery.expandSeedKeywords(
      ["failing", "succeeding"],
      (msg) => messages.push(msg)
    );

    // Should still get results from the successful request
    expect(keywords.length).toBeGreaterThan(0);
    // Should have logged the error
    expect(messages.some((m) => m.includes("Error"))).toBe(true);
  });

  it("should handle malformed API responses gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tasks: [{ result: null }] }), // Missing items
    });

    const discovery = new KeywordDiscovery(client, { delayMs: 0 });
    const keywords = await discovery.expandSeedKeywords(["test"], () => {});

    expect(keywords).toEqual([]);
  });
});
