import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatOpportunity, printTopOpportunities } from "./pipeline.js";
import { createKeyword, type NicheOpportunity } from "./types/domain.js";

describe("formatOpportunity", () => {
  it("should format opportunity correctly", () => {
    const opportunity: NicheOpportunity = {
      keyword: createKeyword({
        keyword: "json formatter",
        monthlyVolume: 22000,
        difficultyScore: 25,
        cpc: 2.5,
        competition: 0.15,
        competitionLevel: "LOW",
        intent: "transactional",
        avgCompetitorDa: 45,
        hasOutdatedResults: false,
        serpResults: [
          {
            position: 1,
            url: "https://jsonformatter.org",
            domain: "jsonformatter.org",
            title: "JSON Formatter",
            domainAuthority: 52,
            isTool: true,
          },
        ],
      }),
      opportunityScore: 7.5,
      aiReasoning: "Good opportunity with low competition",
      competitionScore: 6.5,
      intentScore: 8.0,
      commercialScore: 5.0,
      frustrationScore: 0,
    };

    const formatted = formatOpportunity(opportunity);

    expect(formatted.keyword).toBe("json formatter");
    expect(formatted.opportunityScore).toBe(7.5);
    expect(formatted.monthlyVolume).toBe(22000);
    expect(formatted.difficulty).toBe(25);
    expect(formatted.cpc).toBe(2.5);
    expect(formatted.competitionLevel).toBe("LOW");
    expect(formatted.intent).toBe("transactional");
    expect(formatted.aiReasoning).toBe("Good opportunity with low competition");
    expect(formatted.componentScores).toEqual({
      competition: 6.5,
      intent: 8.0,
      commercial: 5.0,
      frustration: 0,
    });
    expect(formatted.topCompetitors).toHaveLength(1);
    expect(formatted.topCompetitors[0].domain).toBe("jsonformatter.org");
  });
});

describe("printTopOpportunities", () => {
  it("should print opportunities", () => {
    const messages: string[] = [];
    const log = (msg: string) => messages.push(msg);

    const opportunities: NicheOpportunity[] = [
      {
        keyword: createKeyword({
          keyword: "test keyword",
          monthlyVolume: 5000,
          difficultyScore: 20,
          cpc: 2.0,
        }),
        opportunityScore: 7.5,
        aiReasoning: "Test reasoning",
        competitionScore: 6.0,
        intentScore: 7.0,
        commercialScore: 4.0,
        frustrationScore: 0,
      },
    ];

    printTopOpportunities(opportunities, log);

    expect(messages).toContain("\n=== Top Opportunities ===\n");
    expect(messages.some((m) => m.includes("7.5/10"))).toBe(true);
    expect(messages.some((m) => m.includes("test keyword"))).toBe(true);
    expect(messages.some((m) => m.includes("Test reasoning"))).toBe(true);
  });

  it("should handle empty opportunities", () => {
    const messages: string[] = [];
    const log = (msg: string) => messages.push(msg);

    printTopOpportunities([], log);

    expect(messages).toContain("\nNo opportunities found.");
  });
});
