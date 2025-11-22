/**
 * Domain types for the SEO Niche Discovery application
 */

export interface SerpResultItem {
  position: number;
  url: string;
  domain: string;
  title: string;
  domainAuthority?: number;
  isTool: boolean;
  lastUpdated?: Date;
}

export interface Keyword {
  keyword: string;
  monthlyVolume: number;
  difficultyScore: number;
  cpc: number;
  competition: number;
  competitionLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  intent: "informational" | "navigational" | "commercial" | "transactional" | null;

  // SERP data
  serpResults: SerpResultItem[];
  avgCompetitorDa: number;
  hasOutdatedResults: boolean;

  // Reddit signals
  redditFrustrationCount: number;
  redditSampleQuotes: string[];
}

export interface NicheOpportunity {
  keyword: Keyword;
  opportunityScore: number; // 1-10
  aiReasoning: string;

  // Component scores
  competitionScore: number;
  intentScore: number;
  commercialScore: number;
  frustrationScore: number;
}

export interface PipelineResult {
  opportunities: NicheOpportunity[];
  totalCost: number;
  requestsMade: number;
  timestamp: Date;
}

export interface CostSummary {
  totalSpent: number;
  requestsMade: number;
  breakdown: {
    keywordDiscovery: number;
    serpAnalysis: number;
    domainMetrics: number;
    aiScoring: number;
  };
}

// Factory functions
export function createKeyword(partial: Partial<Keyword> & { keyword: string }): Keyword {
  return {
    keyword: partial.keyword,
    monthlyVolume: partial.monthlyVolume ?? 0,
    difficultyScore: partial.difficultyScore ?? 0,
    cpc: partial.cpc ?? 0,
    competition: partial.competition ?? 0,
    competitionLevel: partial.competitionLevel ?? null,
    intent: partial.intent ?? null,
    serpResults: partial.serpResults ?? [],
    avgCompetitorDa: partial.avgCompetitorDa ?? 0,
    hasOutdatedResults: partial.hasOutdatedResults ?? false,
    redditFrustrationCount: partial.redditFrustrationCount ?? 0,
    redditSampleQuotes: partial.redditSampleQuotes ?? [],
  };
}

export function passesFilters(
  kw: Keyword,
  filters: {
    minVolume?: number;
    maxVolume?: number;
    maxDifficulty?: number;
    minCpc?: number;
  } = {}
): boolean {
  const { minVolume = 1000, maxVolume = 50000, maxDifficulty = 30, minCpc = 1.0 } = filters;
  return (
    kw.monthlyVolume >= minVolume &&
    kw.monthlyVolume <= maxVolume &&
    kw.difficultyScore <= maxDifficulty &&
    kw.cpc >= minCpc
  );
}
