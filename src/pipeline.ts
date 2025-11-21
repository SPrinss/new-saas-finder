import { DataForSEOClient } from "./clients/dataforseo.js";
import { KeywordDiscovery } from "./modules/keyword-discovery.js";
import { SerpAnalyzer } from "./modules/serp-analyzer.js";
import { NicheScorer } from "./modules/scorer.js";
import type { NicheOpportunity, PipelineResult } from "./models/types.js";
import { writeFile } from "fs/promises";

export interface PipelineOptions {
  seeds: string[];
  outputFile?: string;
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { seeds, outputFile = "output/results.json" } = options;
  console.log("=== SEO Niche Discovery Pipeline ===\n");

  const client = new DataForSEOClient();
  const discovery = new KeywordDiscovery(client);
  const serpAnalyzer = new SerpAnalyzer(client);
  const scorer = new NicheScorer();

  // Step 1: Expand seed keywords
  console.log("\n[1/3] Keyword Discovery");
  const keywords = await discovery.expandSeedKeywords(seeds);
  console.log(`Cost so far: ${client.getCostSummary()}`);

  // Step 2: Analyze SERPs
  console.log("\n[2/3] SERP Analysis");
  const analyzedKeywords = await serpAnalyzer.analyzeKeywords(keywords);
  console.log(`Cost so far: ${client.getCostSummary()}`);

  // Step 3: Score opportunities
  console.log("\n[3/3] Scoring Opportunities");
  const opportunities = await scorer.scoreKeywords(analyzedKeywords);

  // Results
  const result: PipelineResult = {
    opportunities,
    totalCost: client.costTracker.totalSpent + scorer.getCostEstimate(),
    requestsMade: client.costTracker.requestsMade,
    timestamp: new Date(),
  };

  // Save results
  try {
    const outputData = {
      ...result,
      opportunities: opportunities.slice(0, 20).map(formatOpportunity),
    };
    await writeFile(outputFile, JSON.stringify(outputData, null, 2));
    console.log(`\nResults saved to ${outputFile}`);
  } catch (error) {
    console.error("Failed to save results:", error);
  }

  // Print top opportunities
  console.log("\n=== Top 10 Opportunities ===\n");
  for (const opp of opportunities.slice(0, 10)) {
    console.log(
      `${opp.opportunityScore.toFixed(1)}/10 - "${opp.keyword.keyword}" ` +
        `(vol: ${opp.keyword.monthlyVolume}, diff: ${opp.keyword.difficultyScore}, ` +
        `cpc: $${opp.keyword.cpc.toFixed(2)})`
    );
    console.log(`   ${opp.aiReasoning}\n`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total cost: $${result.totalCost.toFixed(4)}`);
  console.log(`Requests made: ${result.requestsMade}`);
  console.log(`Opportunities found: ${opportunities.length}`);

  return result;
}

function formatOpportunity(opp: NicheOpportunity) {
  return {
    keyword: opp.keyword.keyword,
    opportunityScore: opp.opportunityScore,
    monthlyVolume: opp.keyword.monthlyVolume,
    difficulty: opp.keyword.difficultyScore,
    cpc: opp.keyword.cpc,
    avgCompetitorDa: opp.keyword.avgCompetitorDa,
    aiReasoning: opp.aiReasoning,
    topCompetitors: opp.keyword.serpResults.slice(0, 5).map((r) => ({
      url: r.url,
      da: r.domainAuthority,
    })),
  };
}
