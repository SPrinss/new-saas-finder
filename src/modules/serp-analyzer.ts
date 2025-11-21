import { DataForSEOClient } from "../clients/dataforseo.js";
import { config } from "../config.js";
import type { Keyword, SerpResult } from "../models/types.js";

export class SerpAnalyzer {
  constructor(private client: DataForSEOClient) {}

  async analyzeKeywords(keywords: Keyword[]): Promise<Keyword[]> {
    const limit = Math.min(keywords.length, config.limits.maxSerpAnalyses);
    console.log(`Analyzing SERP for ${limit} keywords...`);

    const analyzed: Keyword[] = [];

    for (const keyword of keywords.slice(0, limit)) {
      try {
        const serpItems = await this.client.getSerp(keyword.keyword);

        const serpResults: SerpResult[] = serpItems
          .filter((item) => item.type === "organic")
          .slice(0, 10)
          .map((item, idx) => ({
            position: item.rank_absolute ?? idx + 1,
            url: item.url ?? "",
            domain: item.domain ?? "",
            title: item.title ?? "",
            isTool: this.detectTool(item.url ?? "", item.title ?? ""),
            domainAuthority: undefined,
          }));

        // Get domain metrics for top 3 competitors
        for (const result of serpResults.slice(0, 3)) {
          try {
            const metrics = await this.client.getDomainMetrics(result.domain);
            if (metrics?.rank) {
              // Convert backlinks rank to rough DA estimate (0-100)
              result.domainAuthority = Math.min(100, Math.floor(metrics.rank / 1000));
            }
          } catch {
            // Skip domain metrics on error
          }
        }

        // Calculate average competitor DA
        const dasWithValue = serpResults
          .map((r) => r.domainAuthority)
          .filter((da): da is number => da !== undefined);
        const avgDa = dasWithValue.length
          ? dasWithValue.reduce((a, b) => a + b, 0) / dasWithValue.length
          : 0;

        analyzed.push({
          ...keyword,
          serpResults,
          avgCompetitorDa: avgDa,
          hasOutdatedResults: false, // Would need page content analysis
        });

        // Rate limiting
        await sleep(300);

        // Budget check
        if (!this.client.costTracker.canSpend(0.003)) {
          console.log("Budget limit approaching, stopping SERP analysis");
          break;
        }
      } catch (error) {
        console.error(`Error analyzing "${keyword.keyword}":`, error);
        analyzed.push(keyword); // Keep original
      }
    }

    console.log(`Analyzed ${analyzed.length} keywords`);
    return analyzed;
  }

  private detectTool(url: string, title: string): boolean {
    const toolPatterns = [
      /generator/i,
      /calculator/i,
      /converter/i,
      /maker/i,
      /builder/i,
      /creator/i,
      /checker/i,
      /tool/i,
      /online.*free/i,
      /free.*online/i,
    ];

    const text = `${url} ${title}`;
    return toolPatterns.some((p) => p.test(text));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
