import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DataForSEOClient,
  CostTracker,
  BudgetExceededError,
  DataForSEOError,
  isOrganicResult,
} from "./dataforseo.js";
import {
  mockRelatedKeywordsResponse,
  mockSerpResponse,
  mockBacklinksSummaryResponse,
} from "../__mocks__/dataforseo-responses.js";

describe("CostTracker", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it("should start with zero cost", () => {
    expect(tracker.totalSpent).toBe(0);
    expect(tracker.requestsMade).toBe(0);
  });

  it("should track costs correctly", () => {
    tracker.add(0.001);
    tracker.add(0.002);

    expect(tracker.totalSpent).toBeCloseTo(0.003);
    expect(tracker.requestsMade).toBe(2);
  });

  it("should correctly check budget limits", () => {
    tracker.add(15);

    expect(tracker.canSpend(5, 20)).toBe(true);
    expect(tracker.canSpend(6, 20)).toBe(false);
  });

  it("should reset correctly", () => {
    tracker.add(10);
    tracker.reset();

    expect(tracker.totalSpent).toBe(0);
    expect(tracker.requestsMade).toBe(0);
  });
});

describe("DataForSEOClient", () => {
  let client: DataForSEOClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new DataForSEOClient({
      login: "test_login",
      password: "test_password",
      maxBudget: 20,
    });
    client.fetchFn = mockFetch;
  });

  describe("getRelatedKeywords", () => {
    it("should fetch related keywords successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRelatedKeywordsResponse),
      });

      const items = await client.getRelatedKeywords("json formatter");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(items).toHaveLength(3);
      expect(items[0].keyword_data.keyword).toBe("json formatter online");
    });

    it("should track costs after request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRelatedKeywordsResponse),
      });

      await client.getRelatedKeywords("test");

      expect(client.costTracker.totalSpent).toBeCloseTo(0.001);
      expect(client.costTracker.requestsMade).toBe(1);
    });

    it("should send correct request body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRelatedKeywordsResponse),
      });

      await client.getRelatedKeywords("test keyword", 2826, "de", 25);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody[0]).toEqual({
        keyword: "test keyword",
        location_code: 2826,
        language_code: "de",
        limit: 25,
      });
    });
  });

  describe("getSerp", () => {
    it("should fetch SERP results successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSerpResponse),
      });

      const items = await client.getSerp("json formatter");

      expect(items).toHaveLength(3);
      expect(items[0].type).toBe("organic");
    });

    it("should track correct cost for SERP requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSerpResponse),
      });

      await client.getSerp("test");

      expect(client.costTracker.totalSpent).toBeCloseTo(0.002);
    });
  });

  describe("getDomainMetrics", () => {
    it("should fetch domain metrics successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBacklinksSummaryResponse),
      });

      const metrics = await client.getDomainMetrics("jsonformatter.org");

      expect(metrics).not.toBeNull();
      expect(metrics?.rank).toBe(52);
      expect(metrics?.backlinks).toBe(8500);
      expect(metrics?.referring_domains).toBe(1250);
    });

    it("should return null for empty results", async () => {
      const emptyResponse = {
        ...mockBacklinksSummaryResponse,
        tasks: [{ ...mockBacklinksSummaryResponse.tasks[0], result: [] }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(emptyResponse),
      });

      const metrics = await client.getDomainMetrics("unknown.com");

      expect(metrics).toBeNull();
    });
  });

  describe("error handling", () => {
    it("should throw DataForSEOError on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      await expect(client.getRelatedKeywords("test")).rejects.toThrow(DataForSEOError);
    });

    it("should throw BudgetExceededError when budget is exceeded", async () => {
      const smallBudgetClient = new DataForSEOClient({
        login: "test",
        password: "test",
        maxBudget: 0.001,
      });
      smallBudgetClient.fetchFn = mockFetch;

      // First request succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRelatedKeywordsResponse),
      });
      await smallBudgetClient.getRelatedKeywords("test1");

      // Second request should fail due to budget
      await expect(smallBudgetClient.getRelatedKeywords("test2")).rejects.toThrow(BudgetExceededError);
    });
  });

  describe("getCostSummary", () => {
    it("should return formatted cost summary", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRelatedKeywordsResponse),
      });

      await client.getRelatedKeywords("test1");
      await client.getRelatedKeywords("test2");

      const summary = client.getCostSummary();
      expect(summary).toBe("$0.0020 (2 requests)");
    });
  });
});

describe("isOrganicResult", () => {
  it("should return true for organic results", () => {
    const organicItem = mockSerpResponse.tasks[0].result![0].items![0];
    expect(isOrganicResult(organicItem)).toBe(true);
  });

  it("should return false for non-organic results", () => {
    const paidItem = { type: "paid", rank_group: 1, rank_absolute: 1, position: "top", xpath: "" };
    expect(isOrganicResult(paidItem as any)).toBe(false);
  });
});
