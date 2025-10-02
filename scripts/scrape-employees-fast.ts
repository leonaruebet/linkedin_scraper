#!/usr/bin/env ts-node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { FastEmployeeScraper } from '../lib/scraper/employee-scraper-fast';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('\n⚡ FAST EMPLOYEE SCRAPER WITH PROXIES');
  console.log('═'.repeat(60));

  // Load company URLs
  const checkpointPath = path.join(process.cwd(), 'scraped-data', 'phase1-urls-checkpoint.json');
  if (!fs.existsSync(checkpointPath)) {
    console.log('❌ No company URLs found. Run company scraper first.');
    return;
  }

  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
  const companyUrls = checkpoint.urls || [];

  if (companyUrls.length === 0) {
    console.log('⚠️  No companies in checkpoint');
    return;
  }

  // Load proxies from env
  const proxies = [];
  let proxyIndex = 1;

  while (process.env[`PROXY_${proxyIndex}`]) {
    const proxy = {
      server: process.env[`PROXY_${proxyIndex}`] || '',
      username: process.env[`PROXY_${proxyIndex}_USER`],
      password: process.env[`PROXY_${proxyIndex}_PASS`]
    };

    if (proxy.server) {
      proxies.push(proxy);
    }

    proxyIndex++;
  }

  // Limit companies if specified
  const maxCompanies = process.env.MAX_COMPANIES
    ? parseInt(process.env.MAX_COMPANIES)
    : companyUrls.length;

  const companiesToScrape = companyUrls.slice(0, maxCompanies);

  console.log(`📊 Companies: ${companiesToScrape.length}`);
  console.log(`🌐 Proxies: ${proxies.length > 0 ? proxies.length : 'None (using direct)'}`);
  console.log(`👥 Employees per company: 4`);
  console.log(`📧 Will extract: Email & Phone`);
  console.log('═'.repeat(60));

  const scraper = new FastEmployeeScraper(
    process.env.LINKEDIN_EMAIL,
    process.env.LINKEDIN_PASSWORD,
    proxies,
    4 // Only 4 employees per company
  );

  try {
    await scraper.initialize();
    await scraper.scrapeEmployeesParallel(companiesToScrape);
    await scraper.close();

    console.log('═'.repeat(60));
    console.log('✅ SCRAPING COMPLETE');
    console.log('═'.repeat(60));
    console.log('📁 Data: scraped-data/employees-with-contact.json');
    console.log('📝 Checkpoint: scraped-data/fast-employee-checkpoint.json');
    console.log('');
    console.log('💡 To view data:');
    console.log('   cat scraped-data/employees-with-contact.json | jq .');
    console.log('═'.repeat(60));
    console.log('');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await scraper.close();
    process.exit(1);
  }
}

main();
