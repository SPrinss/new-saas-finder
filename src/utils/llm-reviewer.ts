/**
 * LLM Reviewer
 * Analyzes structured logs and provides improvement suggestions
 */

import { readFile, readdir } from "fs/promises";
import { OpenAI } from "openai";
import type { ModuleExecutionLog, TestExecutionLog } from "./structured-logger.js";

export interface ReviewResult {
  timestamp: string;
  logsReviewed: string[];
  analysis: {
    overallStatus: "healthy" | "needs_attention" | "critical";
    successRate: number;
    commonErrors: string[];
    performanceIssues: string[];
    costIssues: string[];
  };
  suggestions: Array<{
    priority: "high" | "medium" | "low";
    category: "bug" | "performance" | "cost" | "quality" | "design";
    issue: string;
    suggestion: string;
    affectedModules: string[];
  }>;
  codeChanges?: Array<{
    file: string;
    reason: string;
    suggestedChange: string;
  }>;
}

export class LLMReviewer {
  private openai: OpenAI | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Review all logs in a directory
   */
  async reviewLogs(logDir: string, useAI = true): Promise<ReviewResult> {
    const files = await readdir(logDir);
    const logFiles = files.filter((f) => f.endsWith(".json") && !f.includes("latest"));

    const logs: ModuleExecutionLog[] = [];

    for (const file of logFiles) {
      try {
        const content = await readFile(`${logDir}/${file}`, "utf-8");
        logs.push(JSON.parse(content));
      } catch (error) {
        console.warn(`Failed to read log file ${file}:`, error);
      }
    }

    if (logs.length === 0) {
      throw new Error(`No log files found in ${logDir}`);
    }

    // Rule-based analysis
    const analysis = this.analyzeLogsRuleBased(logs);

    // AI-based suggestions (if enabled)
    let suggestions: ReviewResult["suggestions"] = [];
    let codeChanges: ReviewResult["codeChanges"] = [];

    if (useAI && this.openai) {
      const aiResult = await this.analyzeLogsWithAI(logs, analysis);
      suggestions = aiResult.suggestions;
      codeChanges = aiResult.codeChanges;
    } else {
      suggestions = this.generateRuleBasedSuggestions(logs, analysis);
    }

    return {
      timestamp: new Date().toISOString(),
      logsReviewed: logFiles,
      analysis,
      suggestions,
      codeChanges,
    };
  }

  /**
   * Rule-based log analysis
   */
  private analyzeLogsRuleBased(logs: ModuleExecutionLog[]): ReviewResult["analysis"] {
    const totalRuns = logs.length;
    const successfulRuns = logs.filter((l) => l.status === "success").length;
    const failedRuns = logs.filter((l) => l.status === "failed").length;
    const successRate = (successfulRuns / totalRuns) * 100;

    // Collect all errors
    const allErrors = logs.flatMap((l) => l.errors);
    const errorMessages = allErrors.map((e) => e.message);
    const commonErrors = this.findCommonPatterns(errorMessages);

    // Performance analysis
    const performanceIssues: string[] = [];
    const avgDuration =
      logs.reduce((sum, l) => sum + (l.duration || 0), 0) / logs.length;

    if (avgDuration > 30000) {
      performanceIssues.push(`High average execution time: ${(avgDuration / 1000).toFixed(1)}s`);
    }

    const slowRuns = logs.filter((l) => (l.duration || 0) > avgDuration * 2);
    if (slowRuns.length > totalRuns * 0.2) {
      performanceIssues.push(
        `${slowRuns.length} runs took >2x average time (possible bottleneck)`
      );
    }

    // Cost analysis
    const costIssues: string[] = [];
    const totalCost = logs.reduce((sum, l) => sum + (l.metrics.totalCost || 0), 0);
    const avgCost = totalCost / logs.length;

    if (avgCost > 1.0) {
      costIssues.push(`High average cost per run: $${avgCost.toFixed(2)}`);
    }

    const costVariance = this.calculateVariance(
      logs.map((l) => l.metrics.totalCost || 0)
    );
    if (costVariance > avgCost * 0.5) {
      costIssues.push(`High cost variance detected (inconsistent spending patterns)`);
    }

    const overallStatus: "healthy" | "needs_attention" | "critical" =
      successRate < 50
        ? "critical"
        : successRate < 80 || costIssues.length > 0 || performanceIssues.length > 1
        ? "needs_attention"
        : "healthy";

    return {
      overallStatus,
      successRate,
      commonErrors,
      performanceIssues,
      costIssues,
    };
  }

  /**
   * AI-based analysis using GPT-4
   */
  private async analyzeLogsWithAI(
    logs: ModuleExecutionLog[],
    ruleBasedAnalysis: ReviewResult["analysis"]
  ): Promise<Pick<ReviewResult, "suggestions" | "codeChanges">> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }

    // Prepare summary for AI (don't send full logs to save tokens)
    const summary = {
      totalRuns: logs.length,
      ruleBasedAnalysis,
      sampleErrors: logs
        .filter((l) => l.errors.length > 0)
        .slice(0, 5)
        .map((l) => ({
          module: l.moduleName,
          errors: l.errors.map((e) => e.message),
          duration: l.duration,
          cost: l.metrics.totalCost,
        })),
      slowestRuns: logs
        .sort((a, b) => (b.duration || 0) - (a.duration || 0))
        .slice(0, 3)
        .map((l) => ({
          module: l.moduleName,
          duration: l.duration,
          operations: l.entries.length,
        })),
      costliestRuns: logs
        .sort((a, b) => (b.metrics.totalCost || 0) - (a.metrics.totalCost || 0))
        .slice(0, 3)
        .map((l) => ({
          module: l.moduleName,
          cost: l.metrics.totalCost,
          apiCalls: l.metrics.apiCalls,
        })),
    };

    const prompt = `You are a senior software engineer reviewing execution logs from a SEO niche discovery system.

**System Context:**
- TypeScript/Node.js application
- Uses DataForSEO API (paid, cost-sensitive)
- Uses OpenAI API for scoring
- Processes keywords, analyzes SERPs, scores opportunities

**Log Summary:**
${JSON.stringify(summary, null, 2)}

**Your Task:**
Analyze the logs and provide:
1. Prioritized list of issues (high/medium/low priority)
2. Specific, actionable suggestions
3. Code changes if applicable

Focus on:
- Bugs and errors (especially recurring ones)
- Performance bottlenecks
- Cost optimization opportunities
- Code quality issues
- Design improvements

Return ONLY a valid JSON object with this structure:
{
  "suggestions": [
    {
      "priority": "high" | "medium" | "low",
      "category": "bug" | "performance" | "cost" | "quality" | "design",
      "issue": "Clear description of the issue",
      "suggestion": "Specific, actionable suggestion",
      "affectedModules": ["module1", "module2"]
    }
  ],
  "codeChanges": [
    {
      "file": "src/path/to/file.ts",
      "reason": "Why this change is needed",
      "suggestedChange": "Specific code change or pattern to apply"
    }
  ]
}`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    return JSON.parse(content);
  }

  /**
   * Generate rule-based suggestions (fallback if no AI)
   */
  private generateRuleBasedSuggestions(
    logs: ModuleExecutionLog[],
    analysis: ReviewResult["analysis"]
  ): ReviewResult["suggestions"] {
    const suggestions: ReviewResult["suggestions"] = [];

    // Error-based suggestions
    if (analysis.commonErrors.length > 0) {
      for (const errorPattern of analysis.commonErrors.slice(0, 3)) {
        suggestions.push({
          priority: "high",
          category: "bug",
          issue: `Recurring error: ${errorPattern}`,
          suggestion: "Add error handling or retry logic for this error pattern",
          affectedModules: logs
            .filter((l) => l.errors.some((e) => e.message.includes(errorPattern)))
            .map((l) => l.moduleName),
        });
      }
    }

    // Performance suggestions
    if (analysis.performanceIssues.length > 0) {
      suggestions.push({
        priority: "medium",
        category: "performance",
        issue: analysis.performanceIssues.join("; "),
        suggestion:
          "Consider adding caching, parallelization, or reducing API calls",
        affectedModules: logs
          .filter((l) => (l.duration || 0) > 20000)
          .map((l) => l.moduleName),
      });
    }

    // Cost suggestions
    if (analysis.costIssues.length > 0) {
      suggestions.push({
        priority: "high",
        category: "cost",
        issue: analysis.costIssues.join("; "),
        suggestion:
          "Review API usage patterns, add caching, or reduce batch sizes",
        affectedModules: logs
          .filter((l) => (l.metrics.totalCost || 0) > 0.5)
          .map((l) => l.moduleName),
      });
    }

    // Success rate suggestion
    if (analysis.successRate < 80) {
      suggestions.push({
        priority: "high",
        category: "quality",
        issue: `Low success rate: ${analysis.successRate.toFixed(1)}%`,
        suggestion: "Improve error handling and add validation for edge cases",
        affectedModules: logs
          .filter((l) => l.status === "failed")
          .map((l) => l.moduleName),
      });
    }

    return suggestions;
  }

  /**
   * Review a single test log
   */
  async reviewTestLog(logPath: string): Promise<string> {
    const content = await readFile(logPath, "utf-8");
    const testLog: TestExecutionLog = JSON.parse(content);

    if (testLog.status === "passed") {
      return "✅ Test passed - no issues detected";
    }

    const analysis = [
      `❌ Test failed: ${testLog.testName}`,
      `File: ${testLog.testFile}`,
      `Duration: ${testLog.duration}ms`,
      "",
      "Error:",
      testLog.error?.message || "Unknown error",
      "",
    ];

    if (testLog.error?.diff) {
      analysis.push("Diff:", testLog.error.diff, "");
    }

    if (testLog.expected && testLog.actual) {
      analysis.push("Expected:", JSON.stringify(testLog.expected, null, 2), "");
      analysis.push("Actual:", JSON.stringify(testLog.actual, null, 2), "");
    }

    // AI suggestion if available
    if (this.openai && testLog.error) {
      const suggestion = await this.suggestFix(testLog);
      analysis.push("", "AI Suggestion:", suggestion);
    }

    return analysis.join("\n");
  }

  /**
   * Suggest a fix for a failed test using AI
   */
  private async suggestFix(testLog: TestExecutionLog): Promise<string> {
    if (!this.openai) return "AI not available";

    const prompt = `A test failed with the following details:

Test: ${testLog.testName}
File: ${testLog.testFile}
Assertion: ${testLog.assertion || "N/A"}

Expected: ${JSON.stringify(testLog.expected, null, 2)}
Actual: ${JSON.stringify(testLog.actual, null, 2)}

Error: ${testLog.error?.message}

Provide a concise (2-3 sentences) suggestion for fixing this test failure.`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    return response.choices[0].message.content || "No suggestion available";
  }

  /**
   * Helper: Find common patterns in strings
   */
  private findCommonPatterns(strings: string[]): string[] {
    if (strings.length === 0) return [];

    const counts = new Map<string, number>();

    for (const str of strings) {
      // Extract key error patterns (first 50 chars, or up to first colon)
      const pattern = str.split(":")[0].substring(0, 50);
      counts.set(pattern, (counts.get(pattern) || 0) + 1);
    }

    return Array.from(counts.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([pattern]) => pattern);
  }

  /**
   * Helper: Calculate variance
   */
  private calculateVariance(numbers: number[]): number {
    const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squareDiffs = numbers.map((n) => Math.pow(n - avg, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / numbers.length);
  }
}
