/**
 * Main Pipeline Orchestrator
 * Coordinates the SEO niche discovery workflow
 */

import { writeFile, mkdir } from "fs/promises";
import { DataForSEOClient } from "./clients/dataforseo.js";
import { RedditClient } from "./clients/reddit.js";
import { KeywordDiscovery } from "./modules/keyword-discovery.js";
import { TrendDiscovery } from "./modules/trend-discovery.js";
import { SerpAnalyzer } from "./modules/serp-analyzer.js";
import { NicheScorer } from "./modules/scorer.js";
import { RedditSignalDiscovery } from "./modules/reddit-signals.js";
import type { Keyword, NicheOpportunity, PipelineResult } from "./types/domain.js";
import { config } from "./config.js";

export interface PipelineOptions {
  // Discovery mode
  mode?: "seed" | "trend";

  // For seed mode
  seeds?: string[];

  // Reddit enrichment
  useReddit?: boolean;

  // Output
  outputFile?: string;
  useAI?: boolean;
  onProgress?: (message: string) => void;
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const {
    mode = "seed",
    seeds = [],
    outputFile = "output/results.json",
    useAI = true,
    useReddit = false,
    onProgress = console.log,
  } = options;

  onProgress(`=== SEO Niche Discovery Pipeline (${mode.toUpperCase()} MODE) ===\n`);

  const client = new DataForSEOClient();
  const serpAnalyzer = new SerpAnalyzer(client, {
    maxSerpAnalyses: config.limits.maxSerpAnalyses,
  });
  const scorer = new NicheScorer({ useAI });

  // Step 1: Discover keywords (mode-dependent)
  let keywords: Keyword[];

  if (mode === "trend") {
    onProgress("\n[1/3] Trend Discovery (analyzing growth patterns)");
    const trendDiscovery = new TrendDiscovery(client);
    const trendingKeywords = await trendDiscovery.discoverTrendingKeywords(onProgress);

    // Convert to regular keywords (trend signals are preserved in the object)
    keywords = trendingKeywords.map(({ trendSignals, ...kw }) => kw);

    onProgress(`\nFound ${trendingKeywords.length} trending keywords`);
    if (trendingKeywords.length > 0) {
      onProgress("\nTop 5 trending:");
      trendingKeywords.slice(0, 5).forEach((kw) => {
        const tk = kw as any;
        onProgress(
          `  • ${kw.keyword} (${kw.monthlyVolume}/mo, +${tk.trendSignals?.yearlyGrowth.toFixed(0)}% YoY)`
        );
      });
    }
  } else {
    // Seed mode
    if (seeds.length === 0) {
      throw new Error("Seed mode requires seeds to be provided");
    }

    onProgress("\n[1/3] Keyword Discovery (expanding seeds)");
    const discovery = new KeywordDiscovery(client, {
      maxSeedKeywords: config.limits.maxSeedKeywords,
      maxExpandedKeywords: config.limits.maxExpandedKeywords,
      filters: config.filters,
    });
    keywords = await discovery.expandSeedKeywords(seeds, onProgress);
  }

  onProgress(`Cost so far: ${client.getCostSummary()}`);

  if (keywords.length === 0) {
    onProgress("No keywords found matching filters. Try adjusting filter criteria.");
    return {
      opportunities: [],
      totalCost: client.costTracker.totalSpent,
      requestsMade: client.costTracker.requestsMade,
      timestamp: new Date(),
    };
  }

  // Step 2: Analyze SERPs
  const stepNum = useReddit ? 4 : 3;
  onProgress(`\n[2/${stepNum}] SERP Analysis`);
  const analyzedKeywords = await serpAnalyzer.analyzeKeywords(keywords, onProgress);
  onProgress(`Cost so far: ${client.getCostSummary()}`);

  // Step 2.5: Enrich with Reddit signals (optional)
  let enrichedKeywords = analyzedKeywords;
  if (useReddit && config.reddit.clientId && config.reddit.clientSecret) {
    onProgress(`\n[3/${stepNum}] Reddit Signal Discovery`);
    const redditClient = new RedditClient({
      clientId: config.reddit.clientId,
      clientSecret: config.reddit.clientSecret,
    });
    const redditDiscovery = new RedditSignalDiscovery(redditClient);

    try {
      enrichedKeywords = await redditDiscovery.enrichKeywords(
        analyzedKeywords.slice(0, 10), // Limit to top 10 to save time
        onProgress
      );

      // Merge enriched keywords with remaining keywords
      if (analyzedKeywords.length > 10) {
        enrichedKeywords = [...enrichedKeywords, ...analyzedKeywords.slice(10)];
      }
    } catch (error) {
      onProgress(
        `Reddit enrichment failed: ${error instanceof Error ? error.message : error}`
      );
      onProgress("Continuing without Reddit data...");
    }
  } else if (useReddit) {
    onProgress("\n⚠️  Reddit credentials not configured, skipping Reddit enrichment");
  }

  // Step 3: Score opportunities
  onProgress(`\n[${stepNum}/${stepNum}] Scoring Opportunities`);
  const opportunities = await scorer.scoreKeywords(enrichedKeywords, onProgress);

  // Calculate total cost
  const totalCost = client.costTracker.totalSpent + scorer.getCostEstimate();

  const result: PipelineResult = {
    opportunities,
    totalCost,
    requestsMade: client.costTracker.requestsMade,
    timestamp: new Date(),
  };

  // Save results
  try {
    await mkdir("output", { recursive: true });
    const outputData = {
      ...result,
      timestamp: result.timestamp.toISOString(),
      opportunities: opportunities.slice(0, 20).map(formatOpportunity),
    };
    await writeFile(outputFile, JSON.stringify(outputData, null, 2));
    onProgress(`\nResults saved to ${outputFile}`);
  } catch (error) {
    onProgress(`Failed to save results: ${error instanceof Error ? error.message : error}`);
  }

  // Print top opportunities
  printTopOpportunities(opportunities.slice(0, 10), onProgress);

  onProgress(`\n=== Summary ===`);
  onProgress(`Total cost: $${totalCost.toFixed(4)}`);
  onProgress(`Requests made: ${result.requestsMade}`);
  onProgress(`Opportunities found: ${opportunities.length}`);

  return result;
}

function formatOpportunity(opp: NicheOpportunity) {
  return {
    keyword: opp.keyword.keyword,
    opportunityScore: opp.opportunityScore,
    monthlyVolume: opp.keyword.monthlyVolume,
    difficulty: opp.keyword.difficultyScore,
    cpc: opp.keyword.cpc,
    competition: opp.keyword.competition,
    competitionLevel: opp.keyword.competitionLevel,
    intent: opp.keyword.intent,
    avgCompetitorDa: opp.keyword.avgCompetitorDa,
    hasOutdatedResults: opp.keyword.hasOutdatedResults,
    aiReasoning: opp.aiReasoning,
    componentScores: {
      competition: opp.competitionScore,
      intent: opp.intentScore,
      commercial: opp.commercialScore,
      frustration: opp.frustrationScore,
    },
    topCompetitors: opp.keyword.serpResults.slice(0, 5).map((r) => ({
      position: r.position,
      url: r.url,
      domain: r.domain,
      da: r.domainAuthority,
      isTool: r.isTool,
    })),
  };
}

function printTopOpportunities(
  opportunities: NicheOpportunity[],
  log: (msg: string) => void
): void {
  if (opportunities.length === 0) {
    log("\nNo opportunities found.");
    return;
  }

  log("\n=== Top Opportunities ===\n");

  for (const opp of opportunities) {
    const kw = opp.keyword;
    log(
      `${opp.opportunityScore.toFixed(1)}/10 - "${kw.keyword}" ` +
        `(vol: ${kw.monthlyVolume.toLocaleString()}, diff: ${kw.difficultyScore}, ` +
        `cpc: $${kw.cpc.toFixed(2)})`
    );
    if (opp.aiReasoning) {
      log(`   ${opp.aiReasoning}`);
    }
    log("");
  }
}

// Export for testing
export { formatOpportunity, printTopOpportunities };
