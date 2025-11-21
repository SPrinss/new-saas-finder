import { OpenAIScorer } from "../clients/openai.js";
import type { Keyword, NicheOpportunity } from "../models/types.js";

export class NicheScorer {
  private aiScorer: OpenAIScorer;

  constructor() {
    this.aiScorer = new OpenAIScorer();
  }

  async scoreKeywords(keywords: Keyword[]): Promise<NicheOpportunity[]> {
    console.log(`Scoring ${keywords.length} keywords...`);

    const opportunities: NicheOpportunity[] = [];

    for (const keyword of keywords) {
      try {
        // Calculate rule-based component scores
        const competitionScore = this.calcCompetitionScore(keyword);
        const intentScore = this.calcIntentScore(keyword);
        const commercialScore = this.calcCommercialScore(keyword);
        const frustrationScore = this.calcFrustrationScore(keyword);

        // Get AI score
        const opportunity = await this.aiScorer.scoreOpportunity(keyword);

        // Combine scores
        opportunity.competitionScore = competitionScore;
        opportunity.intentScore = intentScore;
        opportunity.commercialScore = commercialScore;
        opportunity.frustrationScore = frustrationScore;

        opportunities.push(opportunity);
      } catch (error) {
        console.error(`Error scoring "${keyword.keyword}":`, error);
      }
    }

    // Sort by opportunity score
    opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

    console.log(`Scored ${opportunities.length} opportunities`);
    return opportunities;
  }

  private calcCompetitionScore(kw: Keyword): number {
    // Lower difficulty = higher score
    const diffScore = Math.max(0, 10 - kw.difficultyScore / 3);
    // Lower avg DA = higher score
    const daScore = Math.max(0, 10 - kw.avgCompetitorDa / 10);
    return (diffScore + daScore) / 2;
  }

  private calcIntentScore(kw: Keyword): number {
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
    ];
    const matches = toolTerms.filter((t) =>
      kw.keyword.toLowerCase().includes(t)
    ).length;
    return Math.min(10, matches * 3 + 2);
  }

  private calcCommercialScore(kw: Keyword): number {
    // Higher CPC = higher commercial value
    return Math.min(10, kw.cpc * 2);
  }

  private calcFrustrationScore(kw: Keyword): number {
    // More Reddit frustration = higher opportunity
    return Math.min(10, kw.redditFrustrationCount * 2);
  }

  getCostEstimate(): number {
    return this.aiScorer.getCostEstimate();
  }
}
