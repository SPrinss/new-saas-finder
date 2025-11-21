import { config, validateConfig } from "./config.js";
import { runPipeline } from "./pipeline.js";
import { mkdir } from "fs/promises";

// Default seed queries for tool-based niches
const DEFAULT_SEEDS = [
  "json formatter online",
  "hex to rgb converter",
  "password generator",
  "qr code generator",
  "base64 encoder",
  "word counter",
  "character counter",
  "image resizer online",
  "pdf to word converter",
  "timestamp converter",
  "url encoder",
  "markdown editor online",
  "regex tester",
  "color picker tool",
  "unit converter",
  "hash generator",
  "uuid generator",
  "cron expression generator",
  "diff checker online",
  "json to csv converter",
];

async function main() {
  console.log("SEO Niche Discovery System v0.1.0\n");
  console.log(`Budget limit: $${config.maxBudget}`);

  // Validate config
  const errors = validateConfig();
  if (errors.length > 0) {
    console.error("\nConfiguration errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
    console.error("\nPlease set up your .env file (see .env.example)");
    process.exit(1);
  }

  // Ensure output directory exists
  await mkdir("output", { recursive: true });

  // Get seeds from args or use defaults
  const customSeeds = process.argv.slice(2);
  const seeds = customSeeds.length > 0 ? customSeeds : DEFAULT_SEEDS;

  console.log(`Using ${seeds.length} seed keywords\n`);

  try {
    await runPipeline({ seeds });
  } catch (error) {
    console.error("\nPipeline failed:", error);
    process.exit(1);
  }
}

main();
