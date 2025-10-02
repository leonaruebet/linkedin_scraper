#!/usr/bin/env ts-node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { OptimizedCompanyScraper } from '../lib/scraper/optimized-company-scraper';

async function main() {
  console.log('🚀 OPTIMIZED COMPANY SCRAPER');
  console.log('='.repeat(60));
  console.log('📋 Configuration:');
  console.log('   Search Query: "tech" OR "software" OR "finance" OR "ai" OR "food" OR "thailand"');
  console.log('   Location: Thailand (GeoID: 105146118)');
  console.log('   Company Sizes: 11-50, 51-200, 201-500');
  console.log('   Target: 5,500 companies (FULL RUN)');
  console.log('   Workers: 5 parallel browsers (balanced)');
  console.log('='.repeat(60));
  console.log('');

  const scraper = new OptimizedCompanyScraper(
    process.env.LINKEDIN_EMAIL,
    process.env.LINKEDIN_PASSWORD,
    4 // 4 parallel workers for faster scraping
  );

  try {
    // Initialize all workers
    await scraper.initialize();
    await scraper.loginAllWorkers();

    // SKIP PHASE 1 - Load URLs from checkpoint
    console.log('📂 Loading URLs from Phase 1 checkpoint...');
    const fs = require('fs');
    const path = require('path');
    const checkpointPath = path.join(process.cwd(), 'scraped-data', 'phase1-urls-checkpoint.json');

    if (!fs.existsSync(checkpointPath)) {
      console.log('❌ No checkpoint found. Run Phase 1 first.');
      await scraper.closeAll();
      return;
    }

    const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
    const companyUrls = checkpoint.urls || [];

    if (companyUrls.length === 0) {
      console.log('⚠️  No companies found in checkpoint');
      await scraper.closeAll();
      return;
    }

    console.log(`✅ Loaded ${companyUrls.length} company URLs from checkpoint\n`);

    // PHASE 2: Scrape all companies in parallel with checkpoints
    const companies = await scraper.scrapeCompaniesParallel(companyUrls);

    console.log('\n\n' + '='.repeat(60));
    console.log('📊 SCRAPING COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Total companies scraped: ${companies.length}`);
    console.log(`📁 Data saved to: scraped-data/companies-optimized.json`);
    console.log(`📝 Checkpoint saved to: scraped-data/optimized-company-checkpoint.json`);
    console.log('');
    console.log('💡 To resume if interrupted, just run this script again!');
    console.log('='.repeat(60));

    await scraper.closeAll();

  } catch (error: any) {
    console.error('\n❌ Scraping failed:', error.message);
    await scraper.closeAll();
    process.exit(1);
  }
}

main();
