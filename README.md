# SEO Niche Discovery System

Automated system that identifies profitable, low-competition niches for simple web tools by analyzing keyword data, competitor weakness, and commercial viability.

## Features

- **Keyword Discovery**: Expands seed keywords using DataForSEO Labs API
- **SERP Analysis**: Analyzes top 10 results for each keyword
- **Domain Metrics**: Gets domain authority for competitors
- **AI Scoring**: Uses GPT-4o-mini to score opportunities 1-10
- **Budget Control**: Configurable spending limits ($20 default for testing)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and add your API keys:
```bash
cp .env.example .env
```

3. Get API credentials:
   - **DataForSEO**: Sign up at https://dataforseo.com/ ($50 min deposit, pay-as-you-go)
   - **OpenAI**: Get API key from https://platform.openai.com/

## Usage

Run with default seed keywords:
```bash
npm run dev
```

Run with custom seeds:
```bash
npm run dev "json formatter" "csv converter" "image resizer"
```

## Budget Estimates

With $20 budget (~$6-10 actual usage):
- 20 seed keywords
- 500 expanded keywords
- 100 SERP analyses
- AI scoring for top candidates

## Output

Results are saved to `output/results.json` with:
- Top 20 opportunities ranked by score
- Keyword metrics (volume, difficulty, CPC)
- Competitor analysis
- AI reasoning for each opportunity

## Project Structure

```
src/
├── clients/           # API clients (DataForSEO, OpenAI)
├── models/            # TypeScript types
├── modules/           # Pipeline modules
│   ├── keyword-discovery.ts
│   ├── serp-analyzer.ts
│   └── scorer.ts
├── config.ts          # Configuration
├── pipeline.ts        # Main pipeline orchestrator
└── index.ts           # CLI entry point
```
