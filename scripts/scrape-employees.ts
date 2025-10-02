#!/usr/bin/env ts-node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { EmployeeScraper } from '../lib/scraper/employee-scraper';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('\n👥 LINKEDIN EMPLOYEE SCRAPER');
  console.log('═'.repeat(60));
  console.log('🎯 Target: Sales & Management professionals');
  console.log('📋 Source: Companies from phase1-urls-checkpoint.json');
  console.log('═'.repeat(60));

  // Load company URLs from Phase 1 checkpoint
  const checkpointPath = path.join(process.cwd(), 'scraped-data', 'phase1-urls-checkpoint.json');

  if (!fs.existsSync(checkpointPath)) {
    console.log('\n❌ No company URLs found!');
    console.log('   Please run the company scraper first to collect URLs.');
    return;
  }

  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
  const companyUrls = checkpoint.urls || [];

  if (companyUrls.length === 0) {
    console.log('\n⚠️  No companies found in checkpoint');
    return;
  }

  console.log(`\n📊 Found ${companyUrls.length} companies`);

  // Get max companies from env or use default
  const maxCompanies = process.env.MAX_COMPANIES
    ? parseInt(process.env.MAX_COMPANIES)
    : companyUrls.length;

  const companiesToScrape = companyUrls.slice(0, maxCompanies);

  console.log(`   Will scrape: ${companiesToScrape.length} companies`);
  console.log(`   Max employees per company: 20\n`);

  const scraper = new EmployeeScraper(
    process.env.LINKEDIN_EMAIL,
    process.env.LINKEDIN_PASSWORD,
    20 // Max 20 employees per company
  );

  try {
    await scraper.initialize();
    await scraper.scrapeEmployeesFromCompanies(companiesToScrape);
    await scraper.close();

    console.log('═'.repeat(60));
    console.log('✅ EMPLOYEE SCRAPING COMPLETE');
    console.log('═'.repeat(60));
    console.log('📁 Data saved to: scraped-data/employees.json');
    console.log('📝 Checkpoint: scraped-data/employee-checkpoint.json');
    console.log('\n💡 Run again to resume if interrupted!');
    console.log('═'.repeat(60));
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Scraping failed:', error.message);
    await scraper.close();
    process.exit(1);
  }
}

main();
