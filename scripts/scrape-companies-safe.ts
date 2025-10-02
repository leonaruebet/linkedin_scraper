#!/usr/bin/env ts-node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { SafeOptimizedScraper } from '../lib/scraper/safe-optimized-scraper';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('\n🐢 SAFE LINKEDIN SCRAPER');
  console.log('═'.repeat(60));
  console.log('Strategy: Slow & steady wins the race');
  console.log('Daily limit: 100 companies');
  console.log('Delay: 30-60 seconds between companies');
  console.log('Session: 2-hour auto-pause');
  console.log('═'.repeat(60));

  // Load URLs from Phase 1 checkpoint
  const checkpointPath = path.join(process.cwd(), 'scraped-data', 'phase1-urls-checkpoint.json');

  if (!fs.existsSync(checkpointPath)) {
    console.log('\n❌ No URLs found. Run Phase 1 first.');
    return;
  }

  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
  const companyUrls = checkpoint.urls || [];

  if (companyUrls.length === 0) {
    console.log('\n⚠️  No companies found in checkpoint');
    return;
  }

  console.log(`\n📋 Loaded ${companyUrls.length} company URLs\n`);

  const scraper = new SafeOptimizedScraper(
    process.env.LINKEDIN_EMAIL,
    process.env.LINKEDIN_PASSWORD
  );

  try {
    await scraper.initialize();
    await scraper.scrapeCompaniesSafely(companyUrls);
    await scraper.close();

    console.log('═'.repeat(60));
    console.log('✅ SCRAPING SESSION COMPLETE');
    console.log('═'.repeat(60));
    console.log('📁 Data saved to: scraped-data/companies-safe.json');
    console.log('📝 Checkpoint: scraped-data/safe-scraper-checkpoint.json');
    console.log('\n💡 Run this script again tomorrow to continue!');
    console.log('═'.repeat(60));
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Scraping failed:', error.message);
    await scraper.close();
    process.exit(1);
  }
}

main();
