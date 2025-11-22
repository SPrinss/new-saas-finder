/**
 * Reddit Signal Discovery Module
 * Finds demand signals and frustration indicators from Reddit
 */

import { RedditClient } from "../clients/reddit.js";
import type { Keyword } from "../types/domain.js";

export interface RedditSignalOptions {
  subreddits?: string[];
  maxPostsPerKeyword?: number;
  minScore?: number; // Minimum post score to consider
}

const DEFAULT_OPTIONS: RedditSignalOptions = {
  subreddits: [
    "webdev",
    "SaaS",
    "entrepreneur",
    "programming",
    "startups",
    "IndieHackers",
    "webdesign",
    "web_design",
    "Frontend",
    "reactjs",
    "javascript",
  ],
  maxPostsPerKeyword: 25,
  minScore: 5, // Filter out low-quality posts
};

export interface RedditEnrichedKeyword extends Keyword {
  redditSignals: {
    totalPosts: number;
    avgScore: number;
    topPosts: Array<{
      title: string;
      score: number;
      subreddit: string;
      url: string;
    }>;
  };
}

export class RedditSignalDiscovery {
  private client: RedditClient;
  private options: RedditSignalOptions;

  constructor(client: RedditClient, options: Partial<RedditSignalOptions> = {}) {
    this.client = client;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Enrich keywords with Reddit frustration signals
   */
  async enrichKeywords(
    keywords: Keyword[],
    onProgress?: (message: string) => void
  ): Promise<Keyword[]> {
    const log = onProgress ?? console.log;

    log(`Enriching ${keywords.length} keywords with Reddit signals...`);

    const enriched: Keyword[] = [];

    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];

      try {
        log(`[${i + 1}/${keywords.length}] Searching Reddit for: "${keyword.keyword}"`);

        const signals = await this.client.findFrustrationSignals(keyword.keyword, {
          subreddits: this.options.subreddits,
          limit: this.options.maxPostsPerKeyword,
        });

        // Filter low-quality posts
        const qualityPosts = signals.posts.filter(
          (p) => p.score >= (this.options.minScore || 0)
        );

        enriched.push({
          ...keyword,
          redditFrustrationCount: signals.frustrationCount,
          redditSampleQuotes: signals.sampleQuotes.slice(0, 5), // Top 5 quotes
        });

        log(`  Found ${signals.frustrationCount} frustration signals`);
      } catch (error) {
        log(`  Error fetching Reddit data: ${error instanceof Error ? error.message : error}`);

        // Add keyword without Reddit data
        enriched.push(keyword);
      }
    }

    log(`Enriched ${enriched.length} keywords with Reddit data`);

    return enriched;
  }

  /**
   * Discover pain points for a specific topic
   * Returns insights without requiring existing keywords
   */
  async discoverPainPoints(
    topic: string,
    onProgress?: (message: string) => void
  ): Promise<{
    topic: string;
    totalPosts: number;
    commonPainPoints: string[];
    topPosts: Array<{
      title: string;
      snippet: string;
      score: number;
      subreddit: string;
      url: string;
    }>;
    suggestedKeywords: string[];
  }> {
    const log = onProgress ?? console.log;

    log(`Discovering pain points for: "${topic}"`);

    const signals = await this.client.findFrustrationSignals(topic, {
      subreddits: this.options.subreddits,
      limit: 50,
    });

    // Extract common pain points from quotes
    const painPoints = this.extractPainPoints(signals.sampleQuotes);

    // Generate keyword suggestions based on pain points
    const suggestedKeywords = this.generateKeywordSuggestions(topic, painPoints);

    const topPosts = signals.posts.slice(0, 10).map((post) => ({
      title: post.title,
      snippet: post.selftext.substring(0, 200),
      score: post.score,
      subreddit: post.subreddit,
      url: post.permalink,
    }));

    return {
      topic,
      totalPosts: signals.frustrationCount,
      commonPainPoints: painPoints,
      topPosts,
      suggestedKeywords,
    };
  }

  /**
   * Extract pain points from Reddit quotes
   */
  private extractPainPoints(quotes: string[]): string[] {
    const painPoints = new Set<string>();

    // Common frustration patterns
    const patterns = [
      /wish (?:there was|I could|we had) ([^.,!?]+)/gi,
      /looking for (?:a|an) ([^.,!?]+)/gi,
      /need (?:a|an|to) ([^.,!?]+)/gi,
      /(?:can't|cannot|unable to) ([^.,!?]+)/gi,
      /([^.,!?]+) (?:sucks|doesn't work|is terrible|is awful)/gi,
      /there (?:isn't|is no|are no) ([^.,!?]+)/gi,
      /struggling (?:with|to) ([^.,!?]+)/gi,
    ];

    for (const quote of quotes) {
      for (const pattern of patterns) {
        const matches = quote.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            const painPoint = match[1].trim().toLowerCase();
            if (painPoint.length > 5 && painPoint.length < 100) {
              painPoints.add(painPoint);
            }
          }
        }
      }
    }

    return Array.from(painPoints).slice(0, 10);
  }

  /**
   * Generate keyword suggestions based on pain points
   */
  private generateKeywordSuggestions(topic: string, painPoints: string[]): string[] {
    const suggestions = new Set<string>();

    // Add base topic variations
    suggestions.add(`${topic} online`);
    suggestions.add(`${topic} tool`);
    suggestions.add(`free ${topic}`);
    suggestions.add(`${topic} generator`);

    // Add pain point variations
    for (const painPoint of painPoints.slice(0, 5)) {
      suggestions.add(`${painPoint} tool`);
      suggestions.add(`${painPoint} online`);
      suggestions.add(`how to ${painPoint}`);
    }

    return Array.from(suggestions).slice(0, 20);
  }

  /**
   * Analyze Reddit sentiment for a keyword
   */
  async analyzeSentiment(
    keyword: string
  ): Promise<{
    keyword: string;
    sentiment: "positive" | "negative" | "neutral" | "mixed";
    frustrationLevel: "low" | "medium" | "high";
    demandSignals: number;
    competitorMentions: string[];
  }> {
    const signals = await this.client.findFrustrationSignals(keyword, {
      subreddits: this.options.subreddits,
      limit: 50,
    });

    // Analyze frustration level based on quote patterns
    let frustrationIndicators = 0;
    const competitorMentions = new Set<string>();

    for (const quote of signals.sampleQuotes) {
      const lowerQuote = quote.toLowerCase();

      // Frustration indicators
      if (
        lowerQuote.includes("sucks") ||
        lowerQuote.includes("terrible") ||
        lowerQuote.includes("awful") ||
        lowerQuote.includes("hate")
      ) {
        frustrationIndicators++;
      }

      // Extract competitor mentions (tools/services)
      const competitorPatterns = [
        /using ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g,
        /tried ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g,
        /alternative to ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g,
      ];

      for (const pattern of competitorPatterns) {
        const matches = quote.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].length < 30) {
            competitorMentions.add(match[1]);
          }
        }
      }
    }

    const frustrationLevel: "low" | "medium" | "high" =
      frustrationIndicators > 10 ? "high" : frustrationIndicators > 5 ? "medium" : "low";

    const sentiment: "positive" | "negative" | "neutral" | "mixed" =
      frustrationIndicators > 10
        ? "negative"
        : signals.frustrationCount > 20
        ? "mixed"
        : signals.frustrationCount > 5
        ? "neutral"
        : "positive";

    return {
      keyword,
      sentiment,
      frustrationLevel,
      demandSignals: signals.frustrationCount,
      competitorMentions: Array.from(competitorMentions).slice(0, 10),
    };
  }
}
