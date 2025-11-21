/**
 * Niche Scoring Module
 * Scores keyword opportunities using rule-based and AI analysis
 */

import OpenAI from "openai";
import { config } from "../config.js";
import type { Keyword, NicheOpportunity } from "../types/domain.js";

const SCORING_PROMPT = `You are an SEO analyst evaluating niche opportunities for building simple web tools.

Given this keyword data, score the opportunity from 1-10. Consider:
1. Weak competitors (low DA, outdated sites)
2. Tool-based intent (people looking for a tool/generator/calculator)
3. Commercial viability (good CPC indicates monetization potential)
4. Frustration signals (Reddit complaints about existing tools)

Keyword: {keyword}
Monthly Volume: {volume}
Difficulty Score: {difficulty}
CPC: ${"{cpc}"}
Average Competitor DA: {avgDa}
Has Outdated Results: {outdated}
Reddit Frustration Count: {redditCount}
Reddit Quotes: {redditQuotes}

Top 5 Competitors:
{competitors}

Respond with JSON only:
{"score": <1-10>, "reasoning": "<2-3 sentences explaining score>"}`;

export interface ScorerOptions {
  useAI: boolean;
  openaiApiKey?: string;
  model?: string;
}

const DEFAULT_OPTIONS: ScorerOptions = {
  useAI: true,
  model: "gpt-4o-mini",
};

export class NicheScorer {
  private options: ScorerOptions;
  private openai: OpenAI | null = null;
  public totalTokens = 0;

  constructor(options: Partial<ScorerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    if (this.options.useAI) {
      const apiKey = this.options.openaiApiKey ?? config.openaiApiKey;
      if (apiKey) {
        this.openai = new OpenAI({ apiKey });
      }
    }
  }

  async scoreKeywords(
    keywords: Keyword[],
    onProgress?: (message: string) => void
  ): Promise<NicheOpportunity[]> {
    const log = onProgress ?? console.log;
    log(`Scoring ${keywords.length} keywords...`);

    const opportunities: NicheOpportunity[] = [];

    for (const keyword of keywords) {
      try {
        const opportunity = await this.scoreKeyword(keyword);
        opportunities.push(opportunity);
      } catch (error) {
        log(`Error scoring "${keyword.keyword}": ${error instanceof Error ? error.message : error}`);
        // Add with rule-based score only
        opportunities.push(this.createRuleBasedOpportunity(keyword));
      }
    }

    // Sort by opportunity score (descending)
    opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

    log(`Scored ${opportunities.length} opportunities`);
    return opportunities;
  }

  async scoreKeyword(keyword: Keyword): Promise<NicheOpportunity> {
    // Calculate rule-based component scores
    const competitionScore = this.calcCompetitionScore(keyword);
    const intentScore = this.calcIntentScore(keyword);
    const commercialScore = this.calcCommercialScore(keyword);
    const frustrationScore = this.calcFrustrationScore(keyword);

    // Rule-based overall score (weighted average)
    const ruleBasedScore =
      competitionScore * 0.3 +
      intentScore * 0.25 +
      commercialScore * 0.25 +
      frustrationScore * 0.2;

    let opportunityScore = ruleBasedScore;
    let aiReasoning = this.options.useAI ? "" : "Rule-based scoring only";

    // Get AI score if enabled and available
    if (this.options.useAI && this.openai) {
      try {
        const aiResult = await this.getAIScore(keyword);
        // Blend AI and rule-based scores (60% AI, 40% rule-based)
        opportunityScore = aiResult.score * 0.6 + ruleBasedScore * 0.4;
        aiReasoning = aiResult.reasoning;
      } catch {
        // Fall back to rule-based only
        aiReasoning = "AI scoring unavailable - using rule-based score";
      }
    }

    return {
      keyword,
      opportunityScore: Math.round(opportunityScore * 10) / 10,
      aiReasoning,
      competitionScore,
      intentScore,
      commercialScore,
      frustrationScore,
    };
  }

  private createRuleBasedOpportunity(keyword: Keyword): NicheOpportunity {
    const competitionScore = this.calcCompetitionScore(keyword);
    const intentScore = this.calcIntentScore(keyword);
    const commercialScore = this.calcCommercialScore(keyword);
    const frustrationScore = this.calcFrustrationScore(keyword);

    const opportunityScore =
      competitionScore * 0.3 +
      intentScore * 0.25 +
      commercialScore * 0.25 +
      frustrationScore * 0.2;

    return {
      keyword,
      opportunityScore: Math.round(opportunityScore * 10) / 10,
      aiReasoning: "Rule-based scoring only",
      competitionScore,
      intentScore,
      commercialScore,
      frustrationScore,
    };
  }

  private async getAIScore(
    keyword: Keyword
  ): Promise<{ score: number; reasoning: string }> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }

    const competitors =
      keyword.serpResults
        .slice(0, 5)
        .map((r) => `- ${r.url} (DA: ${r.domainAuthority ?? "N/A"})`)
        .join("\n") || "None found";

    const prompt = SCORING_PROMPT.replace("{keyword}", keyword.keyword)
      .replace("{volume}", String(keyword.monthlyVolume))
      .replace("{difficulty}", String(keyword.difficultyScore))
      .replace("{cpc}", keyword.cpc.toFixed(2))
      .replace("{avgDa}", String(keyword.avgCompetitorDa))
      .replace("{outdated}", String(keyword.hasOutdatedResults))
      .replace("{redditCount}", String(keyword.redditFrustrationCount))
      .replace(
        "{redditQuotes}",
        keyword.redditSampleQuotes.slice(0, 3).join("; ") || "None"
      )
      .replace("{competitors}", competitors);

    const response = await this.openai.chat.completions.create({
      model: this.options.model!,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });

    this.totalTokens += response.usage?.total_tokens ?? 0;

    try {
      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        score: Math.min(10, Math.max(1, result.score ?? 5)),
        reasoning: result.reasoning ?? "",
      };
    } catch {
      return { score: 5, reasoning: "Failed to parse AI response" };
    }
  }

  // Rule-based scoring components

  calcCompetitionScore(kw: Keyword): number {
    // Lower difficulty = higher score (0-10 scale)
    const diffScore = Math.max(0, 10 - kw.difficultyScore / 3);
    // Lower avg DA = higher score
    const daScore = Math.max(0, 10 - kw.avgCompetitorDa / 10);
    return (diffScore + daScore) / 2;
  }

  calcIntentScore(kw: Keyword): number {
    // Check for tool-related terms
    const toolTerms = [
      "generator",
      "calculator",
      "converter",
      "maker",
      "builder",
      "checker",
      "tool",
      "online",
      "free",
      "formatter",
      "validator",
    ];
    const matches = toolTerms.filter((t) =>
      kw.keyword.toLowerCase().includes(t)
    ).length;

    // Also consider search intent
    let intentBonus = 0;
    if (kw.intent === "transactional") intentBonus = 3;
    else if (kw.intent === "commercial") intentBonus = 2;

    return Math.min(10, matches * 2 + intentBonus + 2);
  }

  calcCommercialScore(kw: Keyword): number {
    // Higher CPC = higher commercial value
    // CPC of $5+ is excellent, $1 is minimum threshold
    return Math.min(10, kw.cpc * 2);
  }

  calcFrustrationScore(kw: Keyword): number {
    // More Reddit frustration = higher opportunity
    // 5+ mentions is a strong signal
    return Math.min(10, kw.redditFrustrationCount * 2);
  }

  getCostEstimate(): number {
    // GPT-4o-mini: ~$0.15/1M input, $0.60/1M output (rough average)
    return (this.totalTokens * 0.0003) / 1000;
  }
}

// Export component score functions for testing
export const scoringFunctions = {
  competition: (kw: Keyword) => new NicheScorer({ useAI: false }).calcCompetitionScore(kw),
  intent: (kw: Keyword) => new NicheScorer({ useAI: false }).calcIntentScore(kw),
  commercial: (kw: Keyword) => new NicheScorer({ useAI: false }).calcCommercialScore(kw),
  frustration: (kw: Keyword) => new NicheScorer({ useAI: false }).calcFrustrationScore(kw),
};
