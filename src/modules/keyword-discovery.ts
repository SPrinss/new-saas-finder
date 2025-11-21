import { DataForSEOClient, type DataForSEOKeywordItem } from "../clients/dataforseo.js";
import { config } from "../config.js";
import { createKeyword, passesFilters, type Keyword } from "../models/types.js";

export class KeywordDiscovery {
  constructor(private client: DataForSEOClient) {}

  async expandSeedKeywords(seeds: string[]): Promise<Keyword[]> {
    const allKeywords = new Map<string, Keyword>();
    const { limits, filters } = config;

    console.log(`Expanding ${seeds.length} seed keywords...`);

    for (const seed of seeds.slice(0, limits.maxSeedKeywords)) {
      try {
        // Get related keywords
        const related = await this.client.getRelatedKeywords(seed);
        this.processKeywordItems(related, allKeywords);

        // Get suggestions
        const suggestions = await this.client.getKeywordSuggestions(seed);
        this.processKeywordItems(suggestions, allKeywords);

        // Rate limiting - simple delay
        await sleep(200);

        // Check budget
        if (!this.client.costTracker.canSpend(0.002)) {
          console.log("Budget limit approaching, stopping expansion");
          break;
        }

        // Check expanded keyword limit
        if (allKeywords.size >= limits.maxExpandedKeywords) {
          console.log(`Reached ${limits.maxExpandedKeywords} keywords limit`);
          break;
        }
      } catch (error) {
        console.error(`Error expanding "${seed}":`, error);
      }
    }

    // Filter keywords
    const filtered = Array.from(allKeywords.values()).filter((kw) =>
      passesFilters(kw, filters.minVolume, filters.maxVolume, filters.maxDifficulty, filters.minCpc)
    );

    console.log(
      `Found ${allKeywords.size} keywords, ${filtered.length} pass filters`
    );
    return filtered;
  }

  private processKeywordItems(
    items: DataForSEOKeywordItem[],
    map: Map<string, Keyword>
  ): void {
    for (const item of items) {
      if (!item.keyword || map.has(item.keyword)) continue;

      const kw = createKeyword({
        keyword: item.keyword,
        monthlyVolume: item.keyword_info?.search_volume ?? 0,
        difficultyScore: item.keyword_properties?.keyword_difficulty ?? 0,
        cpc: item.keyword_info?.cpc ?? 0,
        competition: item.keyword_info?.competition ?? 0,
      });

      map.set(item.keyword, kw);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
