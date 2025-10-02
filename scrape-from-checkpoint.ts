const { OptimizedCompanyScraper } = require('./lib/scraper/optimized-company-scraper');
import fs from 'fs';
import path from 'path';

async function scrapeFromCheckpoint() {
  console.log('🚀 Starting scraper from Phase 1 checkpoint...\n');

  // Load URLs from Phase 1 checkpoint
  const checkpointPath = path.join(process.cwd(), 'scraped-data', 'phase1-urls-checkpoint.json');

  if (!fs.existsSync(checkpointPath)) {
    console.error('❌ Phase 1 checkpoint not found!');
    console.log('Please run the URL collection phase first.');
    process.exit(1);
  }

  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
  const companyUrls = checkpoint.urls || [];

  console.log(`📋 Found ${companyUrls.length} company URLs to scrape`);
  console.log('═'.repeat(60));

  const scraper = new OptimizedCompanyScraper();

  try {
    // Initialize and login
    await scraper.initialize();
    await scraper.loginAllWorkers();

    // Start scraping all companies from checkpoint
    console.log('\n🔄 Starting Phase 2: Scraping company profiles...\n');
    const companies = await scraper.scrapeCompaniesParallel(companyUrls);

    console.log('\n' + '═'.repeat(60));
    console.log(`✅ SCRAPING COMPLETE!`);
    console.log(`   Total companies scraped: ${companies.length}`);
    console.log('═'.repeat(60));

  } catch (error: any) {
    console.error('\n❌ Scraping failed:', error.message);

    if (error.message.includes('Auth') || error.message.includes('checkpoint')) {
      console.log('\n💡 TIP: Authentication expired or checkpoint detected.');
      console.log('   The stale auth file has been deleted.');
      console.log('   Please re-run this script to login again.\n');
    }
  } finally {
    await scraper.closeAll();
  }
}

scrapeFromCheckpoint();
