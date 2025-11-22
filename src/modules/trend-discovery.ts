/**
 * Trend Discovery Module
 * Identifies rising search trends using DataForSEO historical data
 */

import { DataForSEOClient } from "../clients/dataforseo.js";
import type { Keyword } from "../types/domain.js";
import { createKeyword } from "../types/domain.js";

export interface TrendSignals {
  monthlyGrowth: number; // % change vs previous month
  quarterlyGrowth: number; // % change vs 3 months ago
  yearlyGrowth: number; // % change vs 12 months ago
  pattern: "robust" | "spike" | "declining" | "stable";
  volumeHistory: Array<{ month: number; year: number; volume: number }>;
}

export interface TrendingKeyword extends Keyword {
  trendSignals: TrendSignals;
}

export interface TrendDiscoveryOptions {
  // Categories to explore (e.g., "Internet & Telecom > Web Services")
  categories?: number[];

  // Or use pattern-based exploration
  patterns?: {
    verbs: string[];
    objects: string[];
  };

  // Growth thresholds
  minMonthlyGrowth?: number; // e.g., 20 = +20% minimum
  minQuarterlyGrowth?: number; // e.g., 50
  minYearlyGrowth?: number; // e.g., 100

  // Volume constraints
  minVolume?: number;
  maxVolume?: number;

  // Avoid fads
  requireRobustGrowth?: boolean; // Must be steady, not a spike
}

const DEFAULT_OPTIONS: TrendDiscoveryOptions = {
  patterns: {
    verbs: [
      "generate", "convert", "create", "calculate", "format",
      "validate", "compress", "resize", "merge", "extract",
      "encode", "decode", "minify", "beautify", "analyze"
    ],
    objects: [
      "image", "pdf", "json", "xml", "csv", "video",
      "text", "color", "url", "markdown", "yaml", "sql"
    ],
  },
  minMonthlyGrowth: 10,
  minQuarterlyGrowth: 30,
  minYearlyGrowth: 50,
  minVolume: 1000,
  maxVolume: 10000, // Sweet spot: big enough to matter, small enough to be overlooked
  requireRobustGrowth: true,
};

export class TrendDiscovery {
  private options: TrendDiscoveryOptions;

  constructor(
    private client: DataForSEOClient,
    options: Partial<TrendDiscoveryOptions> = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async discoverTrendingKeywords(
    onProgress?: (message: string) => void
  ): Promise<TrendingKeyword[]> {
    const log = onProgress ?? console.log;

    // Step 1: Generate candidate keywords
    log("Generating candidate keywords...");
    const candidates = this.generateCandidates();
    log(`Generated ${candidates.length} candidate keywords`);

    // Step 2: Fetch historical data in batches (max 700 per request)
    log("Fetching historical search volume data...");
    const withHistory = await this.fetchHistoricalData(candidates, log);
    log(`Retrieved data for ${withHistory.length} keywords`);

    // Step 3: Calculate trend signals
    log("Analyzing growth patterns...");
    const withTrends = withHistory.map((kw) => this.analyzeTrend(kw));

    // Step 4: Filter for rising trends
    const trending = withTrends.filter((kw) => this.isRising(kw));
    log(`Found ${trending.length} rising keywords`);

    // Step 5: Sort by opportunity (highest growth first)
    trending.sort((a, b) => b.trendSignals.yearlyGrowth - a.trendSignals.yearlyGrowth);

    return trending;
  }

  private generateCandidates(): string[] {
    const { patterns } = this.options;
    if (!patterns) return [];

    const candidates = new Set<string>();

    // Pattern: [verb] [object]
    for (const verb of patterns.verbs) {
      for (const object of patterns.objects) {
        candidates.add(`${verb} ${object}`);
        candidates.add(`${object} ${verb}`); // reverse
        candidates.add(`${verb} ${object} online`);
        candidates.add(`free ${object} ${verb}`);
        candidates.add(`${object} ${verb} tool`);
      }
    }

    // AI-related variants (trending category)
    const aiVariants = ["ai", "automated", "smart"];
    for (const ai of aiVariants) {
      for (const verb of patterns.verbs.slice(0, 5)) {
        for (const object of patterns.objects.slice(0, 5)) {
          candidates.add(`${ai} ${verb} ${object}`);
          candidates.add(`${ai} ${object} ${verb}`);
        }
      }
    }

    return Array.from(candidates);
  }

  private async fetchHistoricalData(
    keywords: string[],
    log: (msg: string) => void
  ): Promise<HistoricalKeywordData[]> {
    const results: HistoricalKeywordData[] = [];
    const batchSize = 700; // DataForSEO max

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);

      try {
        const response = await this.client.fetchFn(
          `${this.client["baseUrl"]}/dataforseo_labs/google/historical_search_volume/live`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${this.client["auth"]}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify([
              {
                keywords: batch,
                location_code: 2840, // United States
                language_code: "en",
                include_serp_info: false, // Save cost
              },
            ]),
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = (await response.json()) as HistoricalVolumeResponse;

        // Track cost
        this.client.costTracker.add(0.001 * batch.length);

        // Extract results
        for (const task of data.tasks ?? []) {
          for (const result of task.result ?? []) {
            if (result.keyword_info && result.monthly_searches) {
              results.push({
                keyword: result.keyword,
                currentVolume: result.keyword_info.search_volume ?? 0,
                cpc: result.keyword_info.cpc ?? 0,
                competition: result.keyword_info.competition ?? 0,
                competitionLevel: result.keyword_info.competition_level ?? null,
                difficulty: result.keyword_properties?.keyword_difficulty ?? 0,
                intent: result.search_intent_info?.main_intent ?? null,
                monthlySearches: result.monthly_searches,
              });
            }
          }
        }

        // Rate limiting
        await sleep(300);

        log(`Processed ${Math.min(i + batchSize, keywords.length)}/${keywords.length} keywords`);
      } catch (error) {
        log(`Error fetching batch: ${error instanceof Error ? error.message : error}`);
      }
    }

    return results;
  }

  private analyzeTrend(data: HistoricalKeywordData): TrendingKeyword {
    const history = data.monthlySearches.slice(-12); // Last 12 months
    const currentVolume = data.currentVolume;

    // Calculate growth rates
    const oneMonthAgo = history[history.length - 2]?.search_volume ?? currentVolume;
    const threeMonthsAgo = history[history.length - 4]?.search_volume ?? currentVolume;
    const twelveMonthsAgo = history[0]?.search_volume ?? currentVolume;

    const monthlyGrowth = this.calcGrowth(oneMonthAgo, currentVolume);
    const quarterlyGrowth = this.calcGrowth(threeMonthsAgo, currentVolume);
    const yearlyGrowth = this.calcGrowth(twelveMonthsAgo, currentVolume);

    // Detect pattern
    const pattern = this.detectPattern(history.map((h) => h.search_volume));

    const keyword = createKeyword({
      keyword: data.keyword,
      monthlyVolume: currentVolume,
      difficultyScore: data.difficulty,
      cpc: data.cpc,
      competition: data.competition,
      competitionLevel: data.competitionLevel,
      intent: data.intent,
    });

    return {
      ...keyword,
      trendSignals: {
        monthlyGrowth,
        quarterlyGrowth,
        yearlyGrowth,
        pattern,
        volumeHistory: history.map((h) => ({
          month: h.month,
          year: h.year,
          volume: h.search_volume,
        })),
      },
    };
  }

  private calcGrowth(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue > 0 ? 1000 : 0; // New keyword
    return ((newValue - oldValue) / oldValue) * 100;
  }

  private detectPattern(volumes: number[]): "robust" | "spike" | "declining" | "stable" {
    if (volumes.length < 6) return "stable";

    // Check for spike FIRST (sudden jump then drop)
    // This takes priority over "declining" because it's a specific fad pattern
    const max = Math.max(...volumes);
    const maxIdx = volumes.indexOf(max);
    const isSpike =
      maxIdx < volumes.length - 2 && // Peak is not recent
      volumes[maxIdx] > volumes[maxIdx - 1] * 2 && // Sharp rise
      volumes[volumes.length - 1] < max * 0.7; // Dropped significantly

    if (isSpike) return "spike";

    // Check if declining (overall downward trend)
    const recent = volumes.slice(-3);
    const older = volumes.slice(-6, -3);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    if (recentAvg < olderAvg * 0.8) return "declining";

    // Robust growth: steady increase over time
    let increasingMonths = 0;
    for (let i = 1; i < volumes.length; i++) {
      if (volumes[i] > volumes[i - 1]) increasingMonths++;
    }

    if (increasingMonths >= volumes.length * 0.6) return "robust";

    return "stable";
  }

  private isRising(kw: TrendingKeyword): boolean {
    const { minMonthlyGrowth, minQuarterlyGrowth, minYearlyGrowth, minVolume, maxVolume, requireRobustGrowth } =
      this.options;

    // Volume check
    if (kw.monthlyVolume < (minVolume ?? 0)) return false;
    if (maxVolume && kw.monthlyVolume > maxVolume) return false;

    // Pattern check
    if (requireRobustGrowth && kw.trendSignals.pattern !== "robust") return false;
    if (kw.trendSignals.pattern === "declining") return false;

    // Growth check
    const meetsGrowth =
      kw.trendSignals.monthlyGrowth >= (minMonthlyGrowth ?? 0) ||
      kw.trendSignals.quarterlyGrowth >= (minQuarterlyGrowth ?? 0) ||
      kw.trendSignals.yearlyGrowth >= (minYearlyGrowth ?? 0);

    return meetsGrowth;
  }
}

// Types
interface HistoricalKeywordData {
  keyword: string;
  currentVolume: number;
  cpc: number;
  competition: number;
  competitionLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  difficulty: number;
  intent: "informational" | "navigational" | "commercial" | "transactional" | null;
  monthlySearches: Array<{ year: number; month: number; search_volume: number }>;
}

interface HistoricalVolumeResponse {
  tasks: Array<{
    result: Array<{
      keyword: string;
      keyword_info?: {
        search_volume?: number;
        cpc?: number;
        competition?: number;
        competition_level?: "LOW" | "MEDIUM" | "HIGH";
      };
      keyword_properties?: {
        keyword_difficulty?: number;
      };
      search_intent_info?: {
        main_intent?: "informational" | "navigational" | "commercial" | "transactional";
      };
      monthly_searches?: Array<{ year: number; month: number; search_volume: number }>;
    }>;
  }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
