#!/usr/bin/env ts-node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { CompanyScraper, CompanySearchFilters } from '../lib/scraper/company-scraper';
import fs from 'fs';
import path from 'path';

interface CliArgs {
  keywords?: string;
  industry?: string;
  location?: string;
  size?: string;
  limit?: number;
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
    }
  }

  return args;
}

async function main() {
  const args = parseArgs();

  if (!args.keywords && !args.industry) {
    console.error('❌ Error: --keywords or --industry is required\n');
    console.log('Usage:');
    console.log('  npm run scrape:companies -- --keywords "fintech" --limit 10');
    console.log('  npm run scrape:companies -- --industry "Software" --location "Thailand" --limit 20');
    console.log('  npm run scrape:companies -- --keywords "AI startup" --size "1-50" --limit 15');
    console.log('\nOptions:');
    console.log('  --keywords <text>    Search keywords');
    console.log('  --industry <text>    Industry filter');
    console.log('  --location <text>    Location filter');
    console.log('  --size <range>       Company size (e.g., "1-50", "51-200", "201-500")');
    console.log('  --limit <number>     Number of companies (default: 10)');
    process.exit(1);
  }

  const limit = args.limit || 10;

  console.log('🏢 COMPANY SCRAPER');
  console.log('='.repeat(60));
  console.log('📋 Search Criteria:');
  if (args.keywords) console.log(`   Keywords: ${args.keywords}`);
  if (args.industry) console.log(`   Industry: ${args.industry}`);
  if (args.location) console.log(`   Location: ${args.location}`);
  if (args.size) console.log(`   Size: ${args.size} employees`);
  console.log(`   Limit: ${limit}`);
  console.log('='.repeat(60));
  console.log('');

  const scraper = new CompanyScraper();

  try {
    await scraper.initialize();
    const authenticated = await scraper.login();

    if (!authenticated) {
      console.error('❌ Authentication failed');
      await scraper.close();
      process.exit(1);
    }

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

    // Search companies
    const companyUrls = await scraper.searchCompanies(filters, limit);

    if (companyUrls.length === 0) {
      console.log('⚠️  No companies found');
      await scraper.close();
      return;
    }

    console.log(`\n📊 Found ${companyUrls.length} companies to scrape\n`);
    console.log('='.repeat(60));

    const companies = [];

    for (let i = 0; i < companyUrls.length; i++) {
      const url = companyUrls[i];
      console.log(`\n[${i + 1}/${companyUrls.length}] Scraping company...`);

      const company = await scraper.scrapeCompany(url);

      if (company) {
        companies.push(company);

        console.log(`   ✅ ${company.name}`);
        console.log(`      📍 ${company.headquarters || 'N/A'}`);
        console.log(`      🏭 ${company.industry || 'N/A'}`);
        console.log(`      👥 ${company.companySize || 'N/A'}`);
        if (company.website) console.log(`      🌐 ${company.website}`);
        if (company.phone) console.log(`      📞 ${company.phone}`);
        if (company.email) console.log(`      📧 ${company.email}`);
      } else {
        console.log(`   ❌ Failed to scrape`);
      }

      // Delay between companies
      const delay = Math.floor(Math.random() * 3000) + 2000;
      console.log(`   ⏳ Waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Save results
    const dataDir = path.join(process.cwd(), 'scraped-data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const searchName = args.keywords || args.industry || 'companies';
    const filename = `${searchName.replace(/\s+/g, '_').toLowerCase()}_companies_${Date.now()}.json`;
    const filepath = path.join(dataDir, filename);

    fs.writeFileSync(filepath, JSON.stringify({
      searchCriteria: filters,
      timestamp: new Date().toISOString(),
      totalResults: companies.length,
      companies
    }, null, 2));

    console.log('\n\n' + '='.repeat(60));
    console.log('📊 SCRAPING SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully scraped: ${companies.length} companies`);
    console.log(`📁 Saved to: ${filepath}`);
    console.log('');

    // Display all results
    console.log('🏢 ALL COMPANIES:\n');
    companies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.name}`);
      console.log(`   Industry: ${company.industry || 'N/A'}`);
      console.log(`   Size: ${company.companySize || 'N/A'} (${company.employeeCount || 'N/A'} employees)`);
      console.log(`   Location: ${company.headquarters || 'N/A'}`);
      console.log(`   Website: ${company.website || 'N/A'}`);
      if (company.phone) console.log(`   Phone: ${company.phone}`);
      if (company.email) console.log(`   Email: ${company.email}`);
      console.log(`   LinkedIn: ${company.linkedinUrl}`);
      console.log('');
    });

    console.log('='.repeat(60));

    await scraper.close();
    console.log('\n✅ Scraping completed!');

  } catch (error: any) {
    console.error('\n❌ Scraping failed:', error.message);
    await scraper.close();
    process.exit(1);
  }
}

main();
