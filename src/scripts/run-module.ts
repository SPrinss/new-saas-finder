#!/usr/bin/env tsx
/**
 * CLI for running individual modules with structured logging
 * Usage: npm run module -- <module-name> [options]
 *
 * Examples:
 *   npm run module -- trend-discovery
 *   npm run module -- keyword-discovery --seeds "json formatter,csv converter"
 *   npm run module -- serp-analyzer --keyword "json formatter online"
 */

import { withLogging } from "../utils/structured-logger.js";
import { DataForSEOClient } from "../clients/dataforseo.js";
import { TrendDiscovery } from "../modules/trend-discovery.js";
import { KeywordDiscovery } from "../modules/keyword-discovery.js";
import { SerpAnalyzer } from "../modules/serp-analyzer.js";
import { NicheScorer } from "../modules/scorer.js";
import { config, validateConfig } from "../config.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`Usage: npm run module -- <module-name> [options]

Available modules:
  • trend-discovery       - Discover trending keywords
  • keyword-discovery     - Expand seed keywords (requires --seeds)
  • serp-analyzer        - Analyze SERP for keywords (requires --keywords)
  • scorer               - Score keywords (requires --keywords)

Options:
  --seeds <keywords>     - Comma-separated seed keywords
  --keywords <keywords>  - Comma-separated keywords to analyze
  --no-ai               - Disable AI scoring

Examples:
  npm run module -- trend-discovery
  npm run module -- keyword-discovery --seeds "json formatter,csv converter"
  npm run module -- serp-analyzer --keywords "json formatter online"
  npm run module -- scorer --keywords "json formatter online" --no-ai
`);
    process.exit(1);
  }

  const moduleName = args[0];

  // Validate config
  const errors = validateConfig();
  if (errors.length > 0) {
    console.error("Configuration errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`\n🔬 Running module: ${moduleName}\n`);

  try {
    switch (moduleName) {
      case "trend-discovery":
        await runTrendDiscovery();
        break;

      case "keyword-discovery":
        await runKeywordDiscovery(args);
        break;

      case "serp-analyzer":
        await runSerpAnalyzer(args);
        break;

      case "scorer":
        await runScorer(args);
        break;

      default:
        console.error(`Unknown module: ${moduleName}`);
        process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Module execution failed:", error);
    process.exit(1);
  }
}

async function runTrendDiscovery() {
  const client = new DataForSEOClient();

  const { result, logPath } = await withLogging(
    "TrendDiscovery",
    { mode: "default_patterns" },
    async (logger) => {
      logger.log("info", "initialize_client", {
        metadata: { maxBudget: config.maxBudget },
      });

      const discovery = new TrendDiscovery(client);

      logger.log("info", "start_discovery", {});

      const startTime = Date.now();
      const trends = await discovery.discoverTrendingKeywords((msg) => {
        logger.log("info", "progress", { metadata: { message: msg } });
        console.log(msg);
      });

      const duration = Date.now() - startTime;

      logger.logMetrics({
        totalCost: client.costTracker.totalSpent,
        apiCalls: client.costTracker.requestsMade,
        itemsProcessed: trends.length,
        duration,
      });

      return trends;
    }
  );

  console.log(`\n✅ Found ${result.length} trending keywords`);
  console.log(`💰 Cost: $${client.costTracker.totalSpent.toFixed(4)}`);
  console.log(`📊 Log saved to: ${logPath}\n`);

  if (result.length > 0) {
    console.log("Top 5 trending keywords:");
    result.slice(0, 5).forEach((kw) => {
      const tk = kw as any;
      console.log(
        `  • ${kw.keyword} (${kw.monthlyVolume}/mo, +${tk.trendSignals?.yearlyGrowth.toFixed(0)}% YoY)`
      );
    });
  }
}

async function runKeywordDiscovery(args: string[]) {
  const seedsIndex = args.indexOf("--seeds");
  if (seedsIndex === -1 || !args[seedsIndex + 1]) {
    console.error("❌ --seeds parameter is required");
    console.log('Example: npm run module -- keyword-discovery --seeds "json formatter,csv converter"');
    process.exit(1);
  }

  const seeds = args[seedsIndex + 1].split(",").map((s) => s.trim());
  const client = new DataForSEOClient();

  const { result, logPath } = await withLogging(
    "KeywordDiscovery",
    { seeds },
    async (logger) => {
      logger.log("info", "initialize", {
        input: { seeds, filters: config.filters },
      });

      const discovery = new KeywordDiscovery(client, {
        maxSeedKeywords: config.limits.maxSeedKeywords,
        maxExpandedKeywords: config.limits.maxExpandedKeywords,
        filters: config.filters,
      });

      const startTime = Date.now();
      const keywords = await discovery.expandSeedKeywords(seeds, (msg) => {
        logger.log("info", "progress", { metadata: { message: msg } });
        console.log(msg);
      });

      logger.logMetrics({
        totalCost: client.costTracker.totalSpent,
        apiCalls: client.costTracker.requestsMade,
        itemsProcessed: keywords.length,
        duration: Date.now() - startTime,
      });

      return keywords;
    }
  );

  console.log(`\n✅ Expanded to ${result.length} keywords`);
  console.log(`💰 Cost: $${client.costTracker.totalSpent.toFixed(4)}`);
  console.log(`📊 Log saved to: ${logPath}\n`);
}

async function runSerpAnalyzer(args: string[]) {
  const keywordsIndex = args.indexOf("--keywords");
  if (keywordsIndex === -1 || !args[keywordsIndex + 1]) {
    console.error("❌ --keywords parameter is required");
    console.log('Example: npm run module -- serp-analyzer --keywords "json formatter online,csv converter"');
    process.exit(1);
  }

  const keywordStrings = args[keywordsIndex + 1].split(",").map((s) => s.trim());
  const client = new DataForSEOClient();

  // Create simple keyword objects
  const keywords = keywordStrings.map((kw) => ({
    keyword: kw,
    monthlyVolume: 0,
    difficultyScore: 0,
    cpc: 0,
    competition: 0,
    competitionLevel: null as any,
    intent: null as any,
    serpResults: [],
    avgCompetitorDa: 0,
    hasOutdatedResults: false,
    redditFrustrationCount: 0,
    redditSampleQuotes: [],
  }));

  const { result, logPath } = await withLogging(
    "SerpAnalyzer",
    { keywords: keywordStrings },
    async (logger) => {
      const analyzer = new SerpAnalyzer(client, {
        maxSerpAnalyses: config.limits.maxSerpAnalyses,
      });

      const startTime = Date.now();
      const analyzed = await analyzer.analyzeKeywords(keywords, (msg) => {
        logger.log("info", "progress", { metadata: { message: msg } });
        console.log(msg);
      });

      logger.logMetrics({
        totalCost: client.costTracker.totalSpent,
        apiCalls: client.costTracker.requestsMade,
        itemsProcessed: analyzed.length,
        duration: Date.now() - startTime,
      });

      return analyzed;
    }
  );

  console.log(`\n✅ Analyzed ${result.length} keywords`);
  console.log(`💰 Cost: $${client.costTracker.totalSpent.toFixed(4)}`);
  console.log(`📊 Log saved to: ${logPath}\n`);
}

async function runScorer(args: string[]) {
  const keywordsIndex = args.indexOf("--keywords");
  if (keywordsIndex === -1 || !args[keywordsIndex + 1]) {
    console.error("❌ --keywords parameter is required");
    console.log('Example: npm run module -- scorer --keywords "json formatter online"');
    process.exit(1);
  }

  const useAI = !args.includes("--no-ai");
  const keywordStrings = args[keywordsIndex + 1].split(",").map((s) => s.trim());

  // Create simple keyword objects
  const keywords = keywordStrings.map((kw) => ({
    keyword: kw,
    monthlyVolume: 5000,
    difficultyScore: 25,
    cpc: 2.5,
    competition: 0.3,
    competitionLevel: "MEDIUM" as any,
    intent: "transactional" as any,
    serpResults: [],
    avgCompetitorDa: 30,
    hasOutdatedResults: false,
    redditFrustrationCount: 5,
    redditSampleQuotes: ["Example quote 1", "Example quote 2"],
  }));

  const { result, logPath } = await withLogging(
    "NicheScorer",
    { keywords: keywordStrings, useAI },
    async (logger) => {
      const scorer = new NicheScorer({ useAI });

      const startTime = Date.now();
      const scored = await scorer.scoreKeywords(keywords, (msg) => {
        logger.log("info", "progress", { metadata: { message: msg } });
        console.log(msg);
      });

      logger.logMetrics({
        totalCost: scorer.getCostEstimate(),
        itemsProcessed: scored.length,
        duration: Date.now() - startTime,
      });

      return scored;
    }
  );

  console.log(`\n✅ Scored ${result.length} opportunities`);
  console.log(`📊 Log saved to: ${logPath}\n`);

  result.forEach((opp) => {
    console.log(`\n${opp.opportunityScore.toFixed(1)}/10 - "${opp.keyword.keyword}"`);
    if (opp.aiReasoning) {
      console.log(`  ${opp.aiReasoning}`);
    }
  });
}

main();
