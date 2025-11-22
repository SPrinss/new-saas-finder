/**
 * Keyword Discovery Module
 * Expands seed keywords using DataForSEO Labs API
 */

import { DataForSEOClient } from "../clients/dataforseo.js";
import type { RelatedKeywordItem } from "../types/dataforseo.js";
import { createKeyword, passesFilters, type Keyword } from "../types/domain.js";

export interface KeywordDiscoveryOptions {
  maxSeedKeywords: number;
  maxExpandedKeywords: number;
  filters: {
    minVolume: number;
    maxVolume: number;
    maxDifficulty: number;
    minCpc: number;
  };
  delayMs: number;
}

const DEFAULT_OPTIONS: KeywordDiscoveryOptions = {
  maxSeedKeywords: 20,
  maxExpandedKeywords: 500,
  filters: {
    minVolume: 1000,
    maxVolume: 50000,
    maxDifficulty: 30,
    minCpc: 1.0,
  },
  delayMs: 200,
};

export class KeywordDiscovery {
  private options: KeywordDiscoveryOptions;

  constructor(
    private client: DataForSEOClient,
    options: Partial<KeywordDiscoveryOptions> = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async expandSeedKeywords(
    seeds: string[],
    onProgress?: (message: string) => void
  ): Promise<Keyword[]> {
    const allKeywords = new Map<string, Keyword>();
    const { maxSeedKeywords, maxExpandedKeywords, filters, delayMs } = this.options;

    const log = onProgress ?? console.log;
    log(`Expanding ${Math.min(seeds.length, maxSeedKeywords)} seed keywords...`);

    for (const seed of seeds.slice(0, maxSeedKeywords)) {
      try {
        // Get related keywords
        const related = await this.client.getRelatedKeywords(seed);
        this.processRelatedItems(related, allKeywords);

        // Rate limiting
        await sleep(delayMs);

        // Check budget (estimate next request cost)
        if (!this.client.costTracker.canSpend(0.002, Infinity)) {
          log("Budget limit approaching, stopping expansion");
          break;
        }

        // Check expanded keyword limit
        if (allKeywords.size >= maxExpandedKeywords) {
          log(`Reached ${maxExpandedKeywords} keywords limit`);
          break;
        }
      } catch (error) {
        log(`Error expanding "${seed}": ${error instanceof Error ? error.message : error}`);
      }
    }

    // Filter keywords
    const filtered = Array.from(allKeywords.values()).filter((kw) =>
      passesFilters(kw, filters)
    );

    log(`Found ${allKeywords.size} keywords, ${filtered.length} pass filters`);
    return filtered;
  }

  private processRelatedItems(
    items: RelatedKeywordItem[],
    map: Map<string, Keyword>
  ): void {
    for (const item of items) {
      const kwData = item.keyword_data;
      if (!kwData?.keyword || map.has(kwData.keyword)) continue;

      const kw = createKeyword({
        keyword: kwData.keyword,
        monthlyVolume: kwData.keyword_info?.search_volume ?? 0,
        difficultyScore: kwData.keyword_properties?.keyword_difficulty ?? 0,
        cpc: kwData.keyword_info?.cpc ?? 0,
        competition: kwData.keyword_info?.competition ?? 0,
        competitionLevel: kwData.keyword_info?.competition_level ?? null,
        intent: kwData.search_intent_info?.main_intent ?? null,
      });

      map.set(kwData.keyword, kw);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export for testing
export { sleep };
