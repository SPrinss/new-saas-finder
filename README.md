# SEO Niche Discovery System

Automated system that identifies profitable, low-competition niches for simple web tools by analyzing keyword data, competitor weakness, and commercial viability.

## Features

- **🔥 NEW: Trend Discovery Mode**: Finds rising search trends automatically (no seeds needed!)
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

### Mode 1: Trend Discovery (Recommended - No Seeds Needed!)

Automatically discover rising search trends with growth signals:

```bash
npm run dev -- --trend
```

**How it works:**
1. Generates pattern-based keywords (e.g., "ai image generator", "convert pdf", etc.)
2. Fetches 12 months of historical search volume data
3. Identifies keywords with robust growth (+50% quarterly, +100% yearly)
4. Filters out fads/spikes - only steady, sustainable trends
5. Focuses on sweet spot: 1K-10K volume (big enough to matter, small enough competitors haven't noticed)

**Perfect for finding:**
- ✅ Emerging needs (AI tools, no-code platforms)
- ✅ Early-stage opportunities (before competition arrives)
- ✅ Sustainable trends (not viral spikes)

**Cost:** ~$2-5 per run

---

### Mode 2: Seed Expansion (Traditional Approach)

Expand seed keywords you provide:

```bash
# Default seeds
npm run dev

# Custom seeds
npm run dev "json formatter" "csv converter" "image resizer"
```

**Cost:** ~$5-10 per run

## Budget Estimates

### Trend Discovery Mode (~$2-5 per run)
- Generate ~300 pattern-based keywords
- Fetch historical data for all keywords (~$0.30)
- Analyze growth patterns
- Filter for rising trends (~50-100 results)
- SERP analysis for top trends (~$2)
- AI scoring (~$0.50)

### Seed Expansion Mode (~$5-10 per run)
- 20 seed keywords
- 500 expanded keywords (~$0.50)
- 100 SERP analyses (~$2)
- Domain metrics (~$1)
- AI scoring (~$0.50)

## Output

Results are saved to `output/results.json` with:
- Top 20 opportunities ranked by score
- Keyword metrics (volume, difficulty, CPC)
- Competitor analysis
- AI reasoning for each opportunity

## Output Examples

**Trend Discovery Mode Output:**
```
=== Top 5 Trending Keywords ===

9.2/10 - "ai background remover" (vol: 4,900/mo, +497% YoY)
   Strong growth in AI category. Weak competition in positions 2-4.
   Niche angle: 'AI background remover for product photos'

8.7/10 - "chatgpt prompt generator" (vol: 2,100/mo, +NEW!)
   Brand new category (6 months old). SERP is mostly blogs, not tools.
   GOLDMINE - build a proper prompt generator with templates

7.5/10 - "no code automation" (vol: 3,200/mo, +180% YoY)
   Steady growth. Moderate competition but room for specialized tools
```

## Project Structure

```
src/
├── clients/           # API clients (DataForSEO, OpenAI)
├── types/             # TypeScript types & interfaces
├── modules/           # Pipeline modules
│   ├── trend-discovery.ts    # NEW: Trend analysis
│   ├── keyword-discovery.ts  # Seed expansion
│   ├── serp-analyzer.ts      # SERP analysis
│   └── scorer.ts             # Opportunity scoring
├── config.ts          # Configuration
├── pipeline.ts        # Main pipeline orchestrator
└── index.ts           # CLI entry point
```

## Why Trend Discovery?

**Traditional keyword research** finds what already exists.
**Trend discovery** finds what's emerging - giving you a 6-12 month head start before competition arrives.

**The Edge:**
- 🎯 Data-driven (not guessing)
- ⏰ Early detection (catch trends before they peak)
- 🚫 Fad filtering (avoids viral spikes that crash)
- 💰 High ROI (find opportunities before they're competitive)
