import { OptimizedCompanyScraper } from './lib/scraper/optimized-company-scraper';

async function testAuth() {
  console.log('🧪 Testing LinkedIn Authentication...\n');

  const scraper = new OptimizedCompanyScraper();

  try {
    await scraper.initialize();
    console.log('\n✅ Authentication test passed!');
    console.log('You can now run the full scraper.\n');
  } catch (error: any) {
    console.error('\n❌ Authentication test failed:', error.message);
    console.log('Please check your credentials and try again.\n');
  } finally {
    await scraper.closeAll();
  }
}

testAuth();
