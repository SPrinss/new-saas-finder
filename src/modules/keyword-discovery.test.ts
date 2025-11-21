import { describe, it, expect, vi, beforeEach } from "vitest";
import { KeywordDiscovery } from "./keyword-discovery.js";
import { DataForSEOClient } from "../clients/dataforseo.js";
import {
  mockRelatedKeywordsResponse,
  mockLowVolumeKeywordResponse,
} from "../__mocks__/dataforseo-responses.js";

describe("KeywordDiscovery", () => {
  let client: DataForSEOClient;
  let mockFetch: ReturnType<typeof vi.fn>;
  let discovery: KeywordDiscovery;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new DataForSEOClient({
      login: "test",
      password: "test",
      maxBudget: 100,
    });
    client.fetchFn = mockFetch;
    discovery = new KeywordDiscovery(client, { delayMs: 0 });
  });

  describe("expandSeedKeywords", () => {
    it("should expand seeds and return keywords", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRelatedKeywordsResponse),
      });

      const keywords = await discovery.expandSeedKeywords(["json formatter"], () => {});

      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords[0].keyword).toBeDefined();
    });

    it("should filter out low-volume keywords", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLowVolumeKeywordResponse),
      });

      const keywords = await discovery.expandSeedKeywords(["test"], () => {});

      // The mock has a keyword with volume 100 and cpc 0.5, which should be filtered
      expect(keywords.length).toBe(0);
    });

    it("should respect maxSeedKeywords limit", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRelatedKeywordsResponse),
      });

      const limitedDiscovery = new KeywordDiscovery(client, {
        maxSeedKeywords: 2,
        delayMs: 0,
      });

      await limitedDiscovery.expandSeedKeywords(
        ["seed1", "seed2", "seed3", "seed4"],
        () => {}
      );

      // Should only make 2 API calls (one per seed up to limit)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should deduplicate keywords", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRelatedKeywordsResponse),
      });

      // Call twice with same seed
      const keywords = await discovery.expandSeedKeywords(
        ["json formatter", "json formatter"],
        () => {}
      );

      // Keywords should be unique
      const uniqueKeywords = new Set(keywords.map((k) => k.keyword));
      expect(uniqueKeywords.size).toBe(keywords.length);
    });

    it("should handle API errors gracefully", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockRelatedKeywordsResponse),
        });

      const messages: string[] = [];
      const keywords = await discovery.expandSeedKeywords(
        ["failing", "working"],
        (msg) => messages.push(msg)
      );

      // Should still return results from successful request
      expect(keywords.length).toBeGreaterThan(0);
      expect(messages.some((m) => m.includes("Error"))).toBe(true);
    });

    it("should stop when maxExpandedKeywords is reached", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRelatedKeywordsResponse),
      });

      const smallLimitDiscovery = new KeywordDiscovery(client, {
        maxExpandedKeywords: 2,
        delayMs: 0,
      });

      const messages: string[] = [];
      await smallLimitDiscovery.expandSeedKeywords(
        ["seed1", "seed2", "seed3"],
        (msg) => messages.push(msg)
      );

      expect(messages.some((m) => m.includes("limit"))).toBe(true);
    });

    it("should use custom filters", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRelatedKeywordsResponse),
      });

      const strictDiscovery = new KeywordDiscovery(client, {
        filters: {
          minVolume: 10000, // Higher than most mock data
          maxVolume: 50000,
          maxDifficulty: 30,
          minCpc: 1.0,
        },
        delayMs: 0,
      });

      const keywords = await strictDiscovery.expandSeedKeywords(["test"], () => {});

      // Most keywords should be filtered out due to high minVolume
      expect(keywords.length).toBeLessThan(3);
    });
  });
});
