import OpenAI from "openai";
import { config } from "../config.js";
import type { Keyword, NicheOpportunity } from "../models/types.js";

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

export class OpenAIScorer {
  private client: OpenAI;
  public totalTokens = 0;

  constructor() {
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
  }

  async scoreOpportunity(keyword: Keyword): Promise<NicheOpportunity> {
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

    const response = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });

    this.totalTokens += response.usage?.total_tokens ?? 0;

    let result: { score: number; reasoning: string };
    try {
      result = JSON.parse(response.choices[0].message.content || "{}");
    } catch {
      result = { score: 5, reasoning: "Failed to parse AI response" };
    }

    return {
      keyword,
      opportunityScore: result.score ?? 5,
      aiReasoning: result.reasoning ?? "",
      competitionScore: 0,
      intentScore: 0,
      commercialScore: 0,
      frustrationScore: 0,
    };
  }

  getCostEstimate(): number {
    // GPT-4o-mini: ~$0.15/1M input, $0.60/1M output (rough average)
    return (this.totalTokens * 0.0003) / 1000;
  }
}
