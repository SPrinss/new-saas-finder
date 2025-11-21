import { config } from "../config.js";

// Approximate costs per request (USD)
const COSTS = {
  relatedKeywords: 0.001,
  keywordSuggestions: 0.001,
  serpLive: 0.002,
  serpStandard: 0.0006,
  domainMetrics: 0.001,
} as const;

class CostTracker {
  totalSpent = 0;
  requestsMade = 0;

  add(cost: number): void {
    this.totalSpent += cost;
    this.requestsMade++;
  }

  canSpend(amount: number): boolean {
    return this.totalSpent + amount <= config.maxBudget;
  }
}

export class DataForSEOClient {
  private baseUrl = "https://api.dataforseo.com/v3";
  private auth: string;
  public costTracker = new CostTracker();

  constructor() {
    const creds = `${config.dataforseo.login}:${config.dataforseo.password}`;
    this.auth = Buffer.from(creds).toString("base64");
  }

  private async request<T>(
    endpoint: string,
    data: unknown[],
    costKey: keyof typeof COSTS
  ): Promise<T> {
    const cost = COSTS[costKey];
    if (!this.costTracker.canSpend(cost)) {
      throw new Error(`Budget exceeded: $${this.costTracker.totalSpent.toFixed(2)}`);
    }

    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${this.auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`DataForSEO API error: ${response.status}`);
    }

    this.costTracker.add(cost);
    return response.json() as Promise<T>;
  }

  async getRelatedKeywords(
    keyword: string,
    locationCode = 2840,
    languageCode = "en"
  ): Promise<DataForSEOKeywordItem[]> {
    const data = [
      {
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        limit: 50,
      },
    ];

    const result = await this.request<DataForSEOResponse>(
      "dataforseo_labs/google/related_keywords/live",
      data,
      "relatedKeywords"
    );

    return extractItems(result);
  }

  async getKeywordSuggestions(
    keyword: string,
    locationCode = 2840,
    languageCode = "en"
  ): Promise<DataForSEOKeywordItem[]> {
    const data = [
      {
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        limit: 50,
      },
    ];

    const result = await this.request<DataForSEOResponse>(
      "dataforseo_labs/google/keyword_suggestions/live",
      data,
      "keywordSuggestions"
    );

    return extractItems(result);
  }

  async getSerp(
    keyword: string,
    locationCode = 2840,
    languageCode = "en"
  ): Promise<DataForSEOSerpItem[]> {
    const data = [
      {
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        device: "desktop",
        depth: 10,
      },
    ];

    const result = await this.request<DataForSEOResponse>(
      "serp/google/organic/live/regular",
      data,
      "serpLive"
    );

    return extractItems(result);
  }

  async getDomainMetrics(domain: string): Promise<DomainMetrics | null> {
    const data = [{ target: domain }];

    const result = await this.request<DataForSEOResponse>(
      "backlinks/summary/live",
      data,
      "domainMetrics"
    );

    const items = extractItems(result);
    return items[0] as DomainMetrics | null;
  }

  getCostSummary(): string {
    return `$${this.costTracker.totalSpent.toFixed(4)} (${this.costTracker.requestsMade} requests)`;
  }
}

// Helper to extract items from DataForSEO response
function extractItems<T>(response: DataForSEOResponse): T[] {
  const items: T[] = [];
  if (response.tasks) {
    for (const task of response.tasks) {
      if (task.result) {
        for (const r of task.result) {
          if (r.items) {
            items.push(...(r.items as T[]));
          }
        }
      }
    }
  }
  return items;
}

// DataForSEO response types
interface DataForSEOResponse {
  tasks?: Array<{
    result?: Array<{
      items?: unknown[];
    }>;
  }>;
}

export interface DataForSEOKeywordItem {
  keyword: string;
  keyword_info?: {
    search_volume?: number;
    competition_level?: string;
    competition?: number;
    cpc?: number;
  };
  keyword_properties?: {
    keyword_difficulty?: number;
  };
}

export interface DataForSEOSerpItem {
  rank_absolute?: number;
  url?: string;
  domain?: string;
  title?: string;
  type?: string;
}

export interface DomainMetrics {
  rank?: number;
  backlinks?: number;
  referring_domains?: number;
}
