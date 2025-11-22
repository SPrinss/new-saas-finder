# LLM-Reviewable Logging & Testing System

## Overview

This system enables an LLM to:
1. **Run modules** with structured logging
2. **See execution data** in a standardized format
3. **Interpret results** (success/failure, performance, costs)
4. **Suggest improvements** based on patterns and errors

## Architecture

```
┌─────────────────┐
│  Run Module     │ → Executes with StructuredLogger
│  (npm run       │    Captures: input, output, errors,
│   module)       │    metrics, timing
└────────┬────────┘
         │
         ├─ Saves to: output/logs/<module>-<timestamp>.json
         │
         ▼
┌─────────────────┐
│  LLM Reviewer   │ → Analyzes logs
│  (npm run       │    Rule-based + AI analysis
│   review-logs)  │    Suggests fixes & improvements
└────────┬────────┘
         │
         └─ Generates: output/review-report.json
```

## Components

### 1. StructuredLogger (`src/utils/structured-logger.ts`)

Captures module execution in LLM-readable format:

```typescript
import { withLogging } from "./utils/structured-logger.js";

const { result, logPath } = await withLogging(
  "MyModule",
  { input: "params" },
  async (logger) => {
    logger.log("info", "step_1", { metadata: { detail: "..." } });

    const result = await doWork();

    logger.logMetrics({
      totalCost: 0.05,
      apiCalls: 3,
      itemsProcessed: 100,
    });

    return result;
  }
);
```

**Log structure:**
```json
{
  "sessionId": "TrendDiscovery-1234567890-abc",
  "moduleName": "TrendDiscovery",
  "startTime": "2024-11-22T10:30:00.000Z",
  "endTime": "2024-11-22T10:35:00.000Z",
  "duration": 300000,
  "status": "success",
  "input": { "mode": "default_patterns" },
  "output": [...],
  "errors": [],
  "warnings": [],
  "entries": [
    {
      "timestamp": "2024-11-22T10:30:01.000Z",
      "moduleName": "TrendDiscovery",
      "operation": "generate_candidates",
      "level": "info",
      "output": { "count": 300 },
      "metadata": { "duration": 50 }
    }
  ],
  "metrics": {
    "totalCost": 2.45,
    "apiCalls": 12,
    "itemsProcessed": 87,
    "successRate": 95.4
  }
}
```

### 2. LLMReviewer (`src/utils/llm-reviewer.ts`)

Analyzes logs and provides suggestions:

**Rule-based analysis:**
- Success rates
- Common error patterns
- Performance bottlenecks
- Cost anomalies

**AI analysis (GPT-4o-mini):**
- Root cause identification
- Specific code fixes
- Optimization suggestions
- Design improvements

### 3. CLI Scripts

#### Run Individual Modules

```bash
# Run trend discovery
npm run module -- trend-discovery

# Run keyword discovery
npm run module -- keyword-discovery --seeds "json formatter,csv converter"

# Run SERP analyzer
npm run module -- serp-analyzer --keywords "json formatter online"

# Run scorer
npm run module -- scorer --keywords "json formatter" --no-ai
```

#### Review Logs

```bash
# AI-powered review (uses GPT-4o-mini)
npm run review-logs

# Rule-based only (free, no AI)
npm run review-logs --no-ai

# Custom directory
npm run review-logs --dir output/logs
```

## Usage Examples

### Example 1: Run & Review a Module

```bash
# Step 1: Run trend discovery (generates logs)
npm run module -- trend-discovery

# Output:
# ✅ Found 87 trending keywords
# 💰 Cost: $2.4532
# 📊 Log saved to: output/logs/TrendDiscovery-2024-11-22T10-35-00-000Z.json

# Step 2: Review the logs
npm run review-logs

# Output:
# 🔍 LLM Log Reviewer
#
# === Analysis ===
# Status: ✅ HEALTHY
# Success Rate: 100.0%
# Logs Reviewed: 1
#
# === Suggestions ===
# 🟡 MEDIUM PRIORITY:
#   [PERFORMANCE] Batch API calls taking 45% of execution time
#   → Consider parallelizing DataForSEO requests using Promise.all()
#   Modules: TrendDiscovery
```

### Example 2: Iterative Improvement Loop

```bash
# Run 1: Initial run
npm run module -- keyword-discovery --seeds "json formatter"
# → Log shows: 3 API errors, high cost variance

# Review
npm run review-logs
# → Suggestion: "Add retry logic for rate limit errors"

# Implement fix in keyword-discovery.ts

# Run 2: Test fix
npm run module -- keyword-discovery --seeds "json formatter"
# → Log shows: 0 errors, consistent cost

# Review again
npm run review-logs
# → Status: HEALTHY
```

### Example 3: Compare Module Performance

```bash
# Run module multiple times
npm run module -- trend-discovery
npm run module -- trend-discovery
npm run module -- trend-discovery

# Review all runs
npm run review-logs

# Output shows:
# Performance Issues:
#   • 1 runs took >2x average time (possible bottleneck)
#
# Suggestions:
#   [PERFORMANCE] Run #2 was 3x slower (12 minutes vs 4 minutes avg)
#   → Check network latency or investigate API throttling
```

## Integration with Main Pipeline

You can also add structured logging to the main pipeline:

```typescript
// src/pipeline.ts
import { StructuredLogger } from "./utils/structured-logger.js";

export async function runPipeline(options: PipelineOptions) {
  const logger = new StructuredLogger("Pipeline");

  try {
    logger.logInput(options);

    // ... existing pipeline code ...

    logger.logMetrics({
      totalCost: client.costTracker.totalSpent,
      apiCalls: client.costTracker.requestsMade,
      opportunitiesFound: opportunities.length,
    });

    logger.logOutput(result);
    await logger.finalize();

    return result;
  } catch (error) {
    logger.markFailed(error as Error);
    await logger.finalize();
    throw error;
  }
}
```

## LLM Review Report Structure

After running `npm run review-logs`, the system generates `output/review-report.json`:

```json
{
  "timestamp": "2024-11-22T11:00:00.000Z",
  "logsReviewed": ["TrendDiscovery-2024-11-22T10-35-00-000Z.json"],
  "analysis": {
    "overallStatus": "healthy",
    "successRate": 100.0,
    "commonErrors": [],
    "performanceIssues": [
      "High average execution time: 45.2s"
    ],
    "costIssues": []
  },
  "suggestions": [
    {
      "priority": "medium",
      "category": "performance",
      "issue": "Batch processing causing sequential bottleneck",
      "suggestion": "Parallelize DataForSEO API calls using Promise.all() with rate limiting",
      "affectedModules": ["TrendDiscovery"]
    }
  ],
  "codeChanges": [
    {
      "file": "src/modules/trend-discovery.ts",
      "reason": "Reduce API call latency",
      "suggestedChange": "Replace sequential forEach with Promise.all() and add rate limiter"
    }
  ]
}
```

## Benefits

### For Developers
- **Visibility**: See exactly what each module is doing
- **Debugging**: Trace errors through execution logs
- **Optimization**: Identify performance and cost bottlenecks

### For LLMs
- **Structured Data**: Easy to parse and analyze
- **Context**: Full execution context for better suggestions
- **Metrics**: Quantitative data for objective analysis

### For QA/Testing
- **Reproducibility**: Logs capture full execution state
- **Regression Detection**: Compare logs across runs
- **Automated Review**: AI suggests fixes without manual analysis

## Cost Analysis

### Logging (Free)
- Writing logs: No cost
- Storage: ~50KB per module run

### Review (Rule-based - Free)
- Analyzes logs locally
- No API calls

### Review (AI-powered)
- Uses GPT-4o-mini
- ~500-1000 tokens per review
- Cost: ~$0.0005 per review

## Best Practices

1. **Always log inputs and outputs** - Essential for debugging
2. **Log metrics** - Track cost, time, and success rates
3. **Use meaningful operation names** - Makes logs searchable
4. **Review regularly** - Catch issues early
5. **Act on suggestions** - Implement high-priority fixes first

## Future Enhancements

- [ ] Automatic regression detection
- [ ] Performance benchmarking
- [ ] Cost forecasting
- [ ] Integration test logging
- [ ] Real-time log streaming
- [ ] Automated fix application (LLM writes code)
