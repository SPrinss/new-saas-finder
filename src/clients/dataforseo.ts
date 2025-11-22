/**
 * DataForSEO API client
 * Documentation: https://docs.dataforseo.com/v3/
 */

import { config } from "../config.js";
import { StructuredLogger } from "../utils/structured-logger.js";
import type {
  RelatedKeywordsResponse,
  RelatedKeywordItem,
  KeywordSuggestionsResponse,
  KeywordSuggestionItem,
  SerpResponse,
  SerpItem,
  OrganicSerpItem,
  BacklinksSummaryResponse,
  BacklinksSummaryResult,
} from "../types/dataforseo.js";

// Approximate costs per request (USD) - from DataForSEO pricing
const COSTS = {
  relatedKeywords: 0.001,
  keywordSuggestions: 0.001,
  serpLive: 0.002,
  serpStandard: 0.0006,
  domainMetrics: 0.001,
} as const;

export class CostTracker {
  totalSpent = 0;
  requestsMade = 0;

  add(cost: number): void {
    this.totalSpent += cost;
    this.requestsMade++;
  }

  canSpend(amount: number, maxBudget: number): boolean {
    return this.totalSpent + amount <= maxBudget;
  }

  reset(): void {
    this.totalSpent = 0;
    this.requestsMade = 0;
  }
}

export interface DataForSEOClientOptions {
  login?: string;
  password?: string;
  maxBudget?: number;
  baseUrl?: string;
  logger?: StructuredLogger; // Optional logger for LLM inspection
}

export class DataForSEOClient {
  private baseUrl: string;
  private auth: string;
  private maxBudget: number;
  public costTracker = new CostTracker();
  private logger?: StructuredLogger;

  // Allow injecting fetch for testing
  public fetchFn: typeof fetch = fetch;

  constructor(options: DataForSEOClientOptions = {}) {
    const login = options.login ?? config.dataforseo.login;
    const password = options.password ?? config.dataforseo.password;
    this.maxBudget = options.maxBudget ?? config.maxBudget;
    this.baseUrl = options.baseUrl ?? "https://api.dataforseo.com/v3";
    this.logger = options.logger;

    const creds = `${login}:${password}`;
    this.auth = Buffer.from(creds).toString("base64");

    if (this.logger) {
      this.logger.log("info", "dataforseo_client_initialized", {
        metadata: { baseUrl: this.baseUrl, maxBudget: this.maxBudget },
      });
    }
  }

  private async request<T>(
    endpoint: string,
    data: unknown[],
    costKey: keyof typeof COSTS
  ): Promise<T> {
    const cost = COSTS[costKey];
    const startTime = Date.now();

    if (this.logger) {
      this.logger.log("info", "api_request_start", {
        input: { endpoint, costKey, estimatedCost: cost },
        metadata: {
          budgetRemaining: this.maxBudget - this.costTracker.totalSpent,
          requestCount: this.costTracker.requestsMade,
        },
      });
    }

    if (!this.costTracker.canSpend(cost, this.maxBudget)) {
      const error = new BudgetExceededError(this.costTracker.totalSpent, this.maxBudget);
      if (this.logger) {
        this.logger.log("error", "budget_exceeded", {
          error,
          metadata: { totalSpent: this.costTracker.totalSpent, maxBudget: this.maxBudget },
        });
      }
      throw error;
    }

    try {
      const response = await this.fetchFn(`${this.baseUrl}/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${this.auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = new DataForSEOError(
          `API error: ${response.status} ${response.statusText}`,
          response.status
        );
        if (this.logger) {
          this.logger.log("error", "api_request_failed", {
            error,
            metadata: { status: response.status, endpoint },
          });
        }
        throw error;
      }

      const result = (await response.json()) as T;
      this.costTracker.add(cost);

      const duration = Date.now() - startTime;

      if (this.logger) {
        this.logger.log("info", "api_request_success", {
          output: { status: "success", cost },
          metadata: {
            duration,
            totalSpent: this.costTracker.totalSpent,
            requestsMade: this.costTracker.requestsMade,
          },
        });
      }

      return result;
    } catch (error) {
      if (this.logger && !(error instanceof DataForSEOError)) {
        this.logger.log("error", "api_request_exception", {
          error: error as Error,
          metadata: { endpoint, duration: Date.now() - startTime },
        });
      }
      throw error;
    }
  }

  async getRelatedKeywords(
    keyword: string,
    locationCode = 2840,
    languageCode = "en",
    limit = 50
  ): Promise<RelatedKeywordItem[]> {
    const data = [
      {
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        limit,
      },
    ];

    const result = await this.request<RelatedKeywordsResponse>(
      "dataforseo_labs/google/related_keywords/live",
      data,
      "relatedKeywords"
    );

    return extractItems(result);
  }

  async getKeywordSuggestions(
    keyword: string,
    locationCode = 2840,
    languageCode = "en",
    limit = 50
  ): Promise<KeywordSuggestionItem[]> {
    const data = [
      {
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        limit,
      },
    ];

    const result = await this.request<KeywordSuggestionsResponse>(
      "dataforseo_labs/google/keyword_suggestions/live",
      data,
      "keywordSuggestions"
    );

    return extractItems(result);
  }

  async getSerp(
    keyword: string,
    locationCode = 2840,
    languageCode = "en",
    depth = 10
  ): Promise<SerpItem[]> {
    const data = [
      {
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        device: "desktop",
        depth,
      },
    ];

    const result = await this.request<SerpResponse>(
      "serp/google/organic/live/regular",
      data,
      "serpLive"
    );

    return extractSerpItems(result);
  }

  async getDomainMetrics(domain: string): Promise<BacklinksSummaryResult | null> {
    const data = [{ target: domain }];

    const result = await this.request<BacklinksSummaryResponse>(
      "backlinks/summary/live",
      data,
      "domainMetrics"
    );

    // Backlinks API returns results directly in result array (no nested items)
    return extractBacklinksResult(result);
  }

  getCostSummary(): string {
    return `$${this.costTracker.totalSpent.toFixed(4)} (${this.costTracker.requestsMade} requests)`;
  }
}

// Extract items from standard DataForSEO response structure
function extractItems<T>(response: { tasks: Array<{ result: Array<{ items: T[] | null }> | null }> }): T[] {
  const items: T[] = [];
  for (const task of response.tasks ?? []) {
    for (const result of task.result ?? []) {
      if (result.items) {
        items.push(...result.items);
      }
    }
  }
  return items;
}

// Extract SERP items from response
function extractSerpItems(response: SerpResponse): SerpItem[] {
  const items: SerpItem[] = [];
  for (const task of response.tasks ?? []) {
    for (const result of task.result ?? []) {
      if (result.items) {
        items.push(...result.items);
      }
    }
  }
  return items;
}

// Extract backlinks result (results are directly in result array, not nested in items)
function extractBacklinksResult(response: BacklinksSummaryResponse): BacklinksSummaryResult | null {
  for (const task of response.tasks ?? []) {
    if (task.result && task.result.length > 0) {
      return task.result[0];
    }
  }
  return null;
}

// Custom errors
export class DataForSEOError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "DataForSEOError";
  }
}

export class BudgetExceededError extends Error {
  constructor(
    public currentSpent: number,
    public maxBudget: number
  ) {
    super(`Budget exceeded: $${currentSpent.toFixed(2)} of $${maxBudget.toFixed(2)}`);
    this.name = "BudgetExceededError";
  }
}

// Type guards
export function isOrganicResult(item: SerpItem): item is OrganicSerpItem {
  return item.type === "organic";
}
