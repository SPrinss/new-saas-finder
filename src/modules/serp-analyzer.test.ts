import { describe, it, expect, vi, beforeEach } from "vitest";
import { SerpAnalyzer, TOOL_PATTERNS } from "./serp-analyzer.js";
import { DataForSEOClient } from "../clients/dataforseo.js";
import {
  mockSerpResponse,
  mockBacklinksSummaryResponse,
} from "../__mocks__/dataforseo-responses.js";
import { createKeyword } from "../types/domain.js";

describe("SerpAnalyzer", () => {
  let client: DataForSEOClient;
  let mockFetch: ReturnType<typeof vi.fn>;
  let analyzer: SerpAnalyzer;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new DataForSEOClient({
      login: "test",
      password: "test",
      maxBudget: 100,
    });
    client.fetchFn = mockFetch;
    analyzer = new SerpAnalyzer(client, { delayMs: 0 });
  });

  describe("analyzeKeywords", () => {
    it("should analyze keywords and return enriched results", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSerpResponse),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockBacklinksSummaryResponse),
        });

      const keywords = [createKeyword({ keyword: "json formatter" })];
      const results = await analyzer.analyzeKeywords(keywords, () => {});

      expect(results).toHaveLength(1);
      expect(results[0].serpResults.length).toBeGreaterThan(0);
      expect(results[0].serpResults[0].domain).toBe("jsonformatter.org");
    });

    it("should respect maxSerpAnalyses limit", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSerpResponse),
      });

      const limitedAnalyzer = new SerpAnalyzer(client, {
        maxSerpAnalyses: 2,
        delayMs: 0,
      });

      const keywords = [
        createKeyword({ keyword: "kw1" }),
        createKeyword({ keyword: "kw2" }),
        createKeyword({ keyword: "kw3" }),
      ];

      await limitedAnalyzer.analyzeKeywords(keywords, () => {});

      // Should only make 2 SERP requests (plus domain metrics)
      const serpCalls = mockFetch.mock.calls.filter((call) =>
        call[0].includes("serp")
      );
      expect(serpCalls.length).toBe(2);
    });

    it("should handle errors gracefully", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("API error"))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSerpResponse),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockBacklinksSummaryResponse),
        });

      const keywords = [
        createKeyword({ keyword: "failing" }),
        createKeyword({ keyword: "working" }),
      ];

      const messages: string[] = [];
      const results = await analyzer.analyzeKeywords(keywords, (msg) =>
        messages.push(msg)
      );

      // Should return both keywords (original for failed, enriched for success)
      expect(results).toHaveLength(2);
      expect(messages.some((m) => m.includes("Error"))).toBe(true);
    });
  });

  describe("analyzeKeyword", () => {
    it("should detect tools in SERP results", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSerpResponse),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockBacklinksSummaryResponse),
        });

      const keyword = createKeyword({ keyword: "json formatter" });
      const result = await analyzer.analyzeKeyword(keyword);

      // JSON Formatter & Validator should be detected as a tool
      const toolResults = result.serpResults.filter((r) => r.isTool);
      expect(toolResults.length).toBeGreaterThan(0);
    });

    it("should calculate average competitor DA", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSerpResponse),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockBacklinksSummaryResponse),
        });

      const keyword = createKeyword({ keyword: "test" });
      const result = await analyzer.analyzeKeyword(keyword);

      expect(result.avgCompetitorDa).toBeGreaterThan(0);
    });
  });
});

describe("TOOL_PATTERNS", () => {
  it("should match common tool keywords", () => {
    const toolStrings = [
      "json generator",
      "password calculator",
      "unit converter",
      "logo maker",
      "site builder",
      "qr creator",
      "grammar checker",
      "free online tool",
      "json formatter",
      "json validator",
      "base64 encoder",
      "url decoder",
    ];

    for (const str of toolStrings) {
      const matches = TOOL_PATTERNS.some((p) => p.test(str));
      expect(matches, `Expected "${str}" to match tool pattern`).toBe(true);
    }
  });

  it("should not match non-tool keywords", () => {
    const nonToolStrings = [
      "json tutorial",
      "password security",
      "unit testing",
      "logo design tips",
      "news article",
    ];

    for (const str of nonToolStrings) {
      const matches = TOOL_PATTERNS.some((p) => p.test(str));
      expect(matches, `Expected "${str}" to NOT match tool pattern`).toBe(false);
    }
  });
});
