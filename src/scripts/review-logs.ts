#!/usr/bin/env tsx
/**
 * CLI for reviewing logs with LLM
 * Usage: npm run review-logs [--dir output/logs] [--no-ai]
 */

import { LLMReviewer } from "../utils/llm-reviewer.js";
import { config } from "../config.js";
import { writeFile } from "fs/promises";

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const dirIndex = args.indexOf("--dir");
  const logDir = dirIndex !== -1 && args[dirIndex + 1]
    ? args[dirIndex + 1]
    : "output/logs";

  const useAI = !args.includes("--no-ai");

  console.log("🔍 LLM Log Reviewer\n");
  console.log(`Log directory: ${logDir}`);
  console.log(`AI analysis: ${useAI ? "enabled" : "disabled"}\n`);

  const reviewer = new LLMReviewer(config.anthropicApiKey);

  try {
    console.log("Analyzing logs...\n");
    const result = await reviewer.reviewLogs(logDir, useAI);

    // Print results
    console.log("=== Analysis ===\n");
    console.log(`Status: ${getStatusEmoji(result.analysis.overallStatus)} ${result.analysis.overallStatus.toUpperCase()}`);
    console.log(`Success Rate: ${result.analysis.successRate.toFixed(1)}%`);
    console.log(`Logs Reviewed: ${result.logsReviewed.length}`);

    if (result.analysis.commonErrors.length > 0) {
      console.log("\nCommon Errors:");
      result.analysis.commonErrors.forEach((err) => console.log(`  • ${err}`));
    }

    if (result.analysis.performanceIssues.length > 0) {
      console.log("\nPerformance Issues:");
      result.analysis.performanceIssues.forEach((issue) => console.log(`  • ${issue}`));
    }

    if (result.analysis.costIssues.length > 0) {
      console.log("\nCost Issues:");
      result.analysis.costIssues.forEach((issue) => console.log(`  • ${issue}`));
    }

    // Print suggestions
    if (result.suggestions.length > 0) {
      console.log("\n=== Suggestions ===\n");

      const highPriority = result.suggestions.filter((s) => s.priority === "high");
      const mediumPriority = result.suggestions.filter((s) => s.priority === "medium");
      const lowPriority = result.suggestions.filter((s) => s.priority === "low");

      if (highPriority.length > 0) {
        console.log("🔴 HIGH PRIORITY:");
        highPriority.forEach((s) => printSuggestion(s));
      }

      if (mediumPriority.length > 0) {
        console.log("\n🟡 MEDIUM PRIORITY:");
        mediumPriority.forEach((s) => printSuggestion(s));
      }

      if (lowPriority.length > 0) {
        console.log("\n🟢 LOW PRIORITY:");
        lowPriority.forEach((s) => printSuggestion(s));
      }
    }

    // Print code changes
    if (result.codeChanges && result.codeChanges.length > 0) {
      console.log("\n=== Suggested Code Changes ===\n");
      result.codeChanges.forEach((change, i) => {
        console.log(`${i + 1}. ${change.file}`);
        console.log(`   Reason: ${change.reason}`);
        console.log(`   Change: ${change.suggestedChange}\n`);
      });
    }

    // Save detailed report
    const reportPath = "output/review-report.json";
    await writeFile(reportPath, JSON.stringify(result, null, 2));
    console.log(`\nDetailed report saved to: ${reportPath}`);

  } catch (error) {
    console.error("❌ Review failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case "healthy": return "✅";
    case "needs_attention": return "⚠️";
    case "critical": return "❌";
    default: return "❓";
  }
}

function printSuggestion(s: any): void {
  console.log(`\n  [${s.category.toUpperCase()}] ${s.issue}`);
  console.log(`  → ${s.suggestion}`);
  if (s.affectedModules.length > 0) {
    console.log(`  Modules: ${s.affectedModules.join(", ")}`);
  }
}

main();
