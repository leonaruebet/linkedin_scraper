#!/usr/bin/env ts-node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { HighVolumeCompanyScraper } from '../lib/scraper/high-volume-company-scraper';
import { CompanySearchFilters } from '../lib/scraper/company-scraper';
import fs from 'fs';
import path from 'path';

interface CliArgs {
  keywords?: string;
  industry?: string;
  location?: string;
  size?: string;
  limit?: number;
  workers?: number;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};

  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i].replace('--', '');
    const value = process.argv[i + 1];

    switch (key) {
      case 'keywords':
        args.keywords = value;
        break;
      case 'industry':
        args.industry = value;
        break;
      case 'location':
        args.location = value;
        break;
      case 'size':
        args.size = value;
        break;
      case 'limit':
        args.limit = parseInt(value);
        break;
      case 'workers':
        args.workers = parseInt(value);
        break;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs();

  if (!args.keywords && !args.industry) {
    console.error('❌ Error: --keywords or --industry is required\n');
    console.log('Usage:');
    console.log('  npm run scrape:companies:bulk -- --keywords "technology" --location "Thailand" --limit 100');
    console.log('  npm run scrape:companies:bulk -- --industry "Software" --location "Thailand" --limit 200 --workers 5');
    console.log('  npm run scrape:companies:bulk -- --keywords "AI startup" --size "1-50" --limit 500');
    console.log('\nOptions:');
    console.log('  --keywords <text>    Search keywords');
    console.log('  --industry <text>    Industry filter');
    console.log('  --location <text>    Location filter');
    console.log('  --size <range>       Company size (e.g., "1-50", "51-200", "201-500")');
    console.log('  --limit <number>     Number of companies (default: 100)');
    console.log('  --workers <number>   Parallel workers (default: 3, max: 5)');
    process.exit(1);
  }

  const limit = args.limit || 100;
  const workers = Math.min(args.workers || 3, 5);

  console.log('🏢 HIGH-VOLUME COMPANY SCRAPER');
  console.log('='.repeat(60));
  console.log('📋 Search Criteria:');
  if (args.keywords) console.log(`   Keywords: ${args.keywords}`);
  if (args.industry) console.log(`   Industry: ${args.industry}`);
  if (args.location) console.log(`   Location: ${args.location}`);
  if (args.size) console.log(`   Size: ${args.size} employees`);
  console.log(`   Limit: ${limit}`);
  console.log(`   Workers: ${workers} parallel browsers`);
  console.log('='.repeat(60));
  console.log('');

  const scraper = new HighVolumeCompanyScraper(
    process.env.LINKEDIN_EMAIL,
    process.env.LINKEDIN_PASSWORD,
    workers
  );

  try {
    // Build filters
    const filters: CompanySearchFilters = {
      keywords: args.keywords,
      location: args.location
    };

    if (args.industry) {
      filters.industry = [args.industry];
    }

    if (args.size) {
      filters.companySize = [args.size];
    }

    // Start scraping
    const companies = await scraper.scrapeCompaniesInParallel(filters, limit);

    // Save final results
    const dataDir = path.join(process.cwd(), 'scraped-data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const searchName = args.keywords || args.industry || 'companies';
    const filename = `${searchName.replace(/\s+/g, '_').toLowerCase()}_companies_bulk_${Date.now()}.json`;
    const filepath = path.join(dataDir, filename);

    fs.writeFileSync(filepath, JSON.stringify({
      searchCriteria: filters,
      timestamp: new Date().toISOString(),
      totalResults: companies.length,
      workers,
      companies
    }, null, 2));

    console.log('\n\n' + '='.repeat(60));
    console.log('📊 SCRAPING SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully scraped: ${companies.length} companies`);
    console.log(`📁 Saved to: ${filepath}`);
    console.log('');

    // Display summary
    console.log('🏢 TOP COMPANIES:\n');
    companies.slice(0, 10).forEach((company, index) => {
      console.log(`${index + 1}. ${company.name}`);
      console.log(`   Industry: ${company.industry || 'N/A'}`);
      console.log(`   Size: ${company.companySize || 'N/A'}`);
      console.log(`   Location: ${company.headquarters || 'N/A'}`);
      if (company.website) console.log(`   Website: ${company.website}`);
      if (company.phone) console.log(`   Phone: ${company.phone}`);
      if (company.email) console.log(`   Email: ${company.email}`);
      console.log('');
    });

    if (companies.length > 10) {
      console.log(`... and ${companies.length - 10} more companies`);
      console.log('');
    }

    console.log('='.repeat(60));
    console.log('✅ Scraping completed!');

  } catch (error: any) {
    console.error('\n❌ Scraping failed:', error.message);
    await scraper.closeAll();
    process.exit(1);
  }
}

main();
