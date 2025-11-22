/**
 * Reddit API Client
 * Uses OAuth2 for authentication and search functionality
 * Official API Documentation: https://www.reddit.com/dev/api/
 * Type Documentation: https://github.com/reddit-archive/reddit/wiki/JSON
 */

import { StructuredLogger } from "../utils/structured-logger.js";
import type {
  RedditOAuth2Token,
  RedditListing,
  RedditLink,
  RedditComment as RedditCommentType,
} from "../types/reddit.js";

export interface RedditConfig {
  clientId: string;
  clientSecret: string;
  userAgent?: string;
  logger?: StructuredLogger; // Optional logger for LLM inspection
}

// Simplified types for client usage (transformed from Reddit API types)
export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  score: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
  url: string;
}

export interface RedditComment {
  id: string;
  body: string;
  author: string;
  score: number;
  created_utc: number;
  permalink: string;
}

export interface RedditSearchResult {
  posts: RedditPost[];
  totalResults: number;
}

export class RedditClient {
  private config: RedditConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private userAgent: string;
  private logger?: StructuredLogger;
  public fetchFn: typeof fetch = fetch; // For test injection

  constructor(config: RedditConfig) {
    this.config = config;
    this.userAgent = config.userAgent || "SEONicheFinder/0.1.0";
    this.logger = config.logger;

    if (this.logger) {
      this.logger.log("info", "reddit_client_initialized", {
        metadata: { userAgent: this.userAgent },
      });
    }
  }

  /**
   * Authenticate with Reddit OAuth2
   */
  private async authenticate(): Promise<void> {
    // Check if token is still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return;
    }

    const auth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString("base64");

    const response = await this.fetchFn("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": this.userAgent,
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      throw new Error(`Reddit auth failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as RedditOAuth2Token;
    this.accessToken = data.access_token;
    // Set expiry 5 minutes before actual expiry for safety
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
  }

  /**
   * Search Reddit for posts matching a query
   */
  async search(
    query: string,
    options: {
      subreddit?: string;
      sort?: "relevance" | "hot" | "top" | "new" | "comments";
      timeFilter?: "hour" | "day" | "week" | "month" | "year" | "all";
      limit?: number;
    } = {}
  ): Promise<RedditSearchResult> {
    const startTime = Date.now();
    const { subreddit = "all", sort = "relevance", timeFilter = "year", limit = 100 } = options;

    if (this.logger) {
      this.logger.log("info", "reddit_search_start", {
        input: { query, subreddit, sort, timeFilter, limit },
      });
    }

    try {
      await this.authenticate();

      const params = new URLSearchParams({
        q: query,
        sort,
        t: timeFilter,
        limit: limit.toString(),
        restrict_sr: "false",
        raw_json: "1",
      });

      const endpoint = subreddit === "all"
        ? `https://oauth.reddit.com/search?${params}`
        : `https://oauth.reddit.com/r/${subreddit}/search?${params}`;

      const response = await this.fetchFn(endpoint, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "User-Agent": this.userAgent,
        },
      });

      if (!response.ok) {
        const error = new Error(`Reddit search failed: ${response.status} ${response.statusText}`);
        if (this.logger) {
          this.logger.log("error", "reddit_search_failed", {
            error,
            metadata: { status: response.status, query, subreddit },
          });
        }
        throw error;
      }

      const data = (await response.json()) as RedditListing<RedditLink>;
      const posts = data.data.children
        .filter((child) => child.kind === "t3") // t3 = post
        .map((child) => this.normalizePost(child.data as RedditLink));

      const result = {
        posts,
        totalResults: data.data.dist || 0,
      };

      if (this.logger) {
        this.logger.log("info", "reddit_search_success", {
          output: { postsFound: posts.length, totalResults: result.totalResults },
          metadata: { duration: Date.now() - startTime, query },
        });
      }

      return result;
    } catch (error) {
      if (this.logger) {
        this.logger.log("error", "reddit_search_exception", {
          error: error as Error,
          metadata: { query, duration: Date.now() - startTime },
        });
      }
      throw error;
    }
  }

  /**
   * Search for frustration signals around a topic
   * Looks for phrases like "wish there was", "looking for", "X sucks"
   */
  async findFrustrationSignals(
    topic: string,
    options: {
      subreddits?: string[];
      limit?: number;
    } = {}
  ): Promise<{
    frustrationCount: number;
    sampleQuotes: string[];
    posts: RedditPost[];
  }> {
    const { subreddits = ["webdev", "SaaS", "entrepreneur", "programming"], limit = 25 } = options;

    const frustrationPatterns = [
      `"wish there was" ${topic}`,
      `"looking for" ${topic}`,
      `"need a tool" ${topic}`,
      `${topic} "sucks"`,
      `${topic} "doesn't work"`,
      `"alternative to" ${topic}`,
    ];

    const allPosts: RedditPost[] = [];
    const quotes: string[] = [];

    // Search each pattern
    for (const pattern of frustrationPatterns) {
      for (const subreddit of subreddits) {
        try {
          const result = await this.search(pattern, {
            subreddit,
            sort: "relevance",
            timeFilter: "year",
            limit: Math.ceil(limit / frustrationPatterns.length),
          });

          allPosts.push(...result.posts);

          // Extract quotes from titles and selftext
          for (const post of result.posts) {
            if (post.title.toLowerCase().includes("wish") ||
                post.title.toLowerCase().includes("looking for") ||
                post.title.toLowerCase().includes("need")) {
              quotes.push(post.title);
            }

            if (post.selftext && post.selftext.length > 20 && post.selftext.length < 500) {
              const text = post.selftext.toLowerCase();
              if (text.includes("wish") || text.includes("looking for") || text.includes("need")) {
                quotes.push(post.selftext.substring(0, 300));
              }
            }
          }

          // Rate limiting - Reddit allows 60 requests per minute
          await sleep(1100);
        } catch (error) {
          console.warn(`Failed to search ${pattern} in r/${subreddit}:`, error);
        }
      }
    }

    // Deduplicate posts by ID
    const uniquePosts = Array.from(
      new Map(allPosts.map((post) => [post.id, post])).values()
    );

    // Take top quotes by score
    const sortedQuotes = quotes
      .filter((q, i, arr) => arr.indexOf(q) === i) // Deduplicate
      .slice(0, 10);

    return {
      frustrationCount: uniquePosts.length,
      sampleQuotes: sortedQuotes,
      posts: uniquePosts.sort((a, b) => b.score - a.score).slice(0, 20),
    };
  }

  /**
   * Get comments from a post
   */
  async getComments(postId: string, limit = 100): Promise<RedditComment[]> {
    await this.authenticate();

    // Extract post details from ID if it's a full permalink
    const cleanId = postId.replace(/^t3_/, "");

    const response = await this.fetchFn(
      `https://oauth.reddit.com/comments/${cleanId}?limit=${limit}&depth=2&raw_json=1`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "User-Agent": this.userAgent,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch comments: ${response.status}`);
    }

    const data = (await response.json()) as RedditListing<RedditCommentType>[];

    if (!data[1] || !data[1].data || !data[1].data.children) {
      return [];
    }

    return data[1].data.children
      .filter((child) => child.kind === "t1") // t1 = comment
      .map((child) => this.normalizeComment(child.data as RedditCommentType));
  }

  private normalizePost(data: RedditLink): RedditPost {
    return {
      id: data.id || "",
      title: data.title || "",
      selftext: data.selftext || "",
      author: data.author || "[deleted]",
      subreddit: data.subreddit || "",
      score: data.score || 0,
      num_comments: data.num_comments || 0,
      created_utc: data.created_utc || 0,
      permalink: `https://reddit.com${data.permalink}`,
      url: data.url || "",
    };
  }

  private normalizeComment(data: RedditCommentType): RedditComment {
    return {
      id: data.id || "",
      body: data.body || "",
      author: data.author || "[deleted]",
      score: data.score || 0,
      created_utc: data.created_utc || 0,
      permalink: `https://reddit.com${data.permalink}`,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
