/**
 * SERP Analyzer Module
 * Analyzes search results and competitor metrics
 */

import { DataForSEOClient, isOrganicResult } from "../clients/dataforseo.js";
import type { OrganicSerpItem } from "../types/dataforseo.js";
import type { Keyword, SerpResultItem } from "../types/domain.js";

export interface SerpAnalyzerOptions {
  maxSerpAnalyses: number;
  maxDomainMetricsPerKeyword: number;
  delayMs: number;
}

const DEFAULT_OPTIONS: SerpAnalyzerOptions = {
  maxSerpAnalyses: 100,
  maxDomainMetricsPerKeyword: 3,
  delayMs: 300,
};

// Tool-related patterns for detection
const TOOL_PATTERNS = [
  /generator/i,
  /calculator/i,
  /converter/i,
  /maker/i,
  /builder/i,
  /creator/i,
  /checker/i,
  /\btool\b/i,
  /online.*free/i,
  /free.*online/i,
  /formatter/i,
  /validator/i,
  /encoder/i,
  /decoder/i,
];

export class SerpAnalyzer {
  private options: SerpAnalyzerOptions;

  constructor(
    private client: DataForSEOClient,
    options: Partial<SerpAnalyzerOptions> = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async analyzeKeywords(
    keywords: Keyword[],
    onProgress?: (message: string) => void
  ): Promise<Keyword[]> {
    const { maxSerpAnalyses, delayMs } = this.options;
    const limit = Math.min(keywords.length, maxSerpAnalyses);

    const log = onProgress ?? console.log;
    log(`Analyzing SERP for ${limit} keywords...`);

    const analyzed: Keyword[] = [];

    for (const keyword of keywords.slice(0, limit)) {
      try {
        const enrichedKeyword = await this.analyzeKeyword(keyword);
        analyzed.push(enrichedKeyword);

        // Rate limiting
        await sleep(delayMs);
      } catch (error) {
        log(`Error analyzing "${keyword.keyword}": ${error instanceof Error ? error.message : error}`);
        analyzed.push(keyword); // Keep original on error
      }
    }

    log(`Analyzed ${analyzed.length} keywords`);
    return analyzed;
  }

  async analyzeKeyword(keyword: Keyword): Promise<Keyword> {
    const { maxDomainMetricsPerKeyword } = this.options;

    // Get SERP results
    const serpItems = await this.client.getSerp(keyword.keyword);

    // Process organic results
    const organicResults = serpItems.filter(isOrganicResult);
    const serpResults: SerpResultItem[] = organicResults.slice(0, 10).map((item) =>
      this.mapSerpItem(item)
    );

    // Get domain metrics for top competitors
    const uniqueDomains = [...new Set(serpResults.map((r) => r.domain))];
    const domainMetrics = new Map<string, number>();

    for (const domain of uniqueDomains.slice(0, maxDomainMetricsPerKeyword)) {
      try {
        const metrics = await this.client.getDomainMetrics(domain);
        if (metrics?.rank) {
          // DataForSEO rank is 0-100 scale
          domainMetrics.set(domain, metrics.rank);
        }
      } catch {
        // Skip on error
      }
    }

    // Enrich SERP results with domain authority
    for (const result of serpResults) {
      const da = domainMetrics.get(result.domain);
      if (da !== undefined) {
        result.domainAuthority = da;
      }
    }

    // Calculate average competitor DA
    const dasWithValue = serpResults
      .map((r) => r.domainAuthority)
      .filter((da): da is number => da !== undefined);
    const avgDa = dasWithValue.length
      ? dasWithValue.reduce((a, b) => a + b, 0) / dasWithValue.length
      : 0;

    // Check for outdated results (simplified - would need more data in real impl)
    const hasOutdatedResults = this.checkForOutdatedResults(organicResults);

    return {
      ...keyword,
      serpResults,
      avgCompetitorDa: Math.round(avgDa * 10) / 10,
      hasOutdatedResults,
    };
  }

  private mapSerpItem(item: OrganicSerpItem): SerpResultItem {
    return {
      position: item.rank_absolute,
      url: item.url,
      domain: item.domain,
      title: item.title,
      isTool: this.detectTool(item.url, item.title),
      domainAuthority: item.rank_info?.main_domain_rank,
    };
  }

  private detectTool(url: string, title: string): boolean {
    const text = `${url} ${title}`;
    return TOOL_PATTERNS.some((pattern) => pattern.test(text));
  }

  private checkForOutdatedResults(items: OrganicSerpItem[]): boolean {
    // Check if any top results have old rank changes data
    // This is a simplified check - real implementation would analyze page content
    for (const item of items.slice(0, 5)) {
      if (item.rank_changes?.is_new === false && item.rank_info?.page_rank) {
        // Low page rank + not new could indicate stale content
        if (item.rank_info.page_rank < 20) {
          return true;
        }
      }
    }
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export for testing
export { TOOL_PATTERNS, sleep as serpSleep };
