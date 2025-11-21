import "dotenv/config";

export const config = {
  // DataForSEO credentials
  dataforseo: {
    login: process.env.DATAFORSEO_LOGIN || "",
    password: process.env.DATAFORSEO_PASSWORD || "",
  },

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY || "",

  // Reddit (optional)
  reddit: {
    clientId: process.env.REDDIT_CLIENT_ID || "",
    clientSecret: process.env.REDDIT_CLIENT_SECRET || "",
  },

  // Budget control (USD)
  maxBudget: parseFloat(process.env.MAX_BUDGET || "20"),

  // Search parameters for ~$20 budget
  limits: {
    maxSeedKeywords: 20,
    maxExpandedKeywords: 500,
    maxSerpAnalyses: 100,
  },

  // Keyword filters
  filters: {
    minVolume: 1000,
    maxVolume: 50000,
    maxDifficulty: 30,
    minCpc: 1.0,
  },
} as const;

export function validateConfig(): string[] {
  const errors: string[] = [];
  if (!config.dataforseo.login) errors.push("DATAFORSEO_LOGIN is required");
  if (!config.dataforseo.password) errors.push("DATAFORSEO_PASSWORD is required");
  if (!config.openaiApiKey) errors.push("OPENAI_API_KEY is required");
  return errors;
}
