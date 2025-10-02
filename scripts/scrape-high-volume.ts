#!/usr/bin/env ts-node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { HighVolumeLinkedInScraper } from '../lib/scraper/high-volume-scraper';

interface CliArgs {
  keywords?: string;
  location?: string;
  limit?: number;
  workers?: number;
  delayMin?: number;
  delayMax?: number;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};

  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i].replace('--', '');
    const value = process.argv[i + 1];

    switch (key) {
      case 'keywords':
      case 'role':
        args.keywords = value;
        break;
      case 'location':
        args.location = value;
        break;
      case 'limit':
        args.limit = parseInt(value);
        break;
      case 'workers':
        args.workers = parseInt(value);
        break;
      case 'delay-min':
        args.delayMin = parseInt(value);
        break;
      case 'delay-max':
        args.delayMax = parseInt(value);
        break;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs();

  if (!args.keywords) {
    console.error('❌ Error: --keywords is required\n');
    console.log('Usage:');
    console.log('  npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 5000');
    console.log('\nOptions:');
    console.log('  --keywords <text>     Search keywords (required)');
    console.log('  --location <text>     Location filter (optional)');
    console.log('  --limit <number>      Number of profiles to scrape (default: 1000)');
    console.log('  --workers <number>    Parallel workers (default: 3, max: 5)');
    console.log('  --delay-min <ms>      Min delay between requests (default: 3000)');
    console.log('  --delay-max <ms>      Max delay between requests (default: 7000)');
    console.log('\nExamples:');
    console.log('  # Scrape 5000 sales profiles from Thailand');
    console.log('  npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 5000');
    console.log('');
    console.log('  # Scrape 10000 engineers with custom settings');
    console.log('  npm run scrape:bulk -- --keywords "software engineer" --limit 10000 --workers 5 --delay-min 2000');
    console.log('');
    console.log('  # Resume interrupted scraping (checkpoint is automatic)');
    console.log('  npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 5000');
    process.exit(1);
  }

  const limit = args.limit || 1000;
  const workers = Math.min(args.workers || 3, 5); // Max 5 workers to avoid detection
  const delayMin = args.delayMin || 3000;
  const delayMax = args.delayMax || 7000;

  console.log('🚀 HIGH-VOLUME LINKEDIN SCRAPER');
  console.log('='.repeat(80));
  console.log('📋 Configuration:');
  console.log(`   Keywords:     ${args.keywords}`);
  if (args.location) {
    console.log(`   Location:     ${args.location}`);
  }
  console.log(`   Target:       ${limit.toLocaleString()} profiles`);
  console.log(`   Workers:      ${workers} parallel browsers`);
  console.log(`   Delay:        ${delayMin}-${delayMax}ms between requests`);
  console.log(`   Checkpoint:   Every 50 profiles (auto-resume on failure)`);
  console.log('='.repeat(80));
  console.log('');

  // Estimate time
  const avgDelay = (delayMin + delayMax) / 2;
  const estimatedMinutes = Math.ceil((limit * avgDelay) / (workers * 60000));
  console.log(`⏱️  Estimated time: ~${estimatedMinutes} minutes`);
  console.log(`💡 Tip: This runs in the background. You can stop and resume anytime!`);
  console.log('');

  const scraper = new HighVolumeLinkedInScraper(
    process.env.LINKEDIN_EMAIL,
    process.env.LINKEDIN_PASSWORD,
    {
      maxWorkers: workers,
      delayMin,
      delayMax,
      maxRetries: 3,
      checkpointInterval: 50
    }
  );

  try {
    await scraper.scrapeHighVolume(args.keywords, args.location, limit);
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
