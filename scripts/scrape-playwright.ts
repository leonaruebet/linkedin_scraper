#!/usr/bin/env ts-node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { PlaywrightLinkedInScraper } from '../lib/scraper/playwright-linkedin-scraper';
import { localStorage } from '../lib/services/local-storage-service';
import { LinkedInProfile } from '../lib/types/linkedin';

interface CliArgs {
  keywords?: string;
  location?: string;
  limit?: number;
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
    }
  }

  return args;
}

async function main() {
  const args = parseArgs();

  if (!args.keywords) {
    console.error('❌ Error: --keywords is required');
    console.log('\nUsage:');
    console.log('  npm run scrape:pw -- --keywords "sales" --location "Thailand" --limit 20');
    process.exit(1);
  }

  const limit = args.limit || 10;

  const scraper = new PlaywrightLinkedInScraper();

  try {
    console.log('🚀 LinkedIn Scraper (Playwright)');
    console.log('='.repeat(60));
    console.log(`📋 Search Criteria:`);
    console.log(`   Keywords: ${args.keywords}`);
    if (args.location) {
      console.log(`   Location: ${args.location}`);
    }
    console.log(`   Limit: ${limit}`);
    console.log('='.repeat(60));
    console.log('');

    // Initialize and login
    await scraper.initialize();
    const authenticated = await scraper.login();

    if (!authenticated) {
      console.error('❌ Authentication failed');
      await scraper.close();
      process.exit(1);
    }

    // Search profiles
    console.log('\n🔍 Searching for profiles...\n');
    const profileUrls = await scraper.searchProfiles(
      args.keywords,
      args.location,
      limit
    );

    if (profileUrls.length === 0) {
      console.log('⚠️  No profiles found. Try different keywords or location.');
      await scraper.close();
      return;
    }

    console.log(`\n📊 Found ${profileUrls.length} profiles to scrape\n`);
    console.log('='.repeat(60));

    // Scrape each profile
    const profiles: LinkedInProfile[] = [];

    for (let i = 0; i < profileUrls.length; i++) {
      const url = profileUrls[i];
      console.log(`\n[${i + 1}/${profileUrls.length}] Scraping profile...`);

      try {
        const profile = await scraper.scrapeProfile(url);

        if (profile) {
          // Save to local storage
          localStorage.saveProfile(profile);
          profiles.push(profile);

          console.log(`   ✅ ${profile.firstName} ${profile.lastName}`);
          console.log(`      📍 ${profile.location || 'N/A'}`);
          console.log(`      💼 ${profile.headline || 'N/A'}`);
          if (profile.experience && profile.experience.length > 0) {
            console.log(`      🏢 ${profile.experience[0].title} at ${profile.experience[0].company}`);
          }
        } else {
          console.log(`   ❌ Failed to scrape profile`);
        }

        // Random delay between profiles (2-5 seconds)
        const delay = Math.floor(Math.random() * 3000) + 2000;
        console.log(`   ⏳ Waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
      }
    }

    // Save search results
    const searchName = `${args.keywords}${args.location ? '_' + args.location : ''}`;
    const filepath = localStorage.saveSearchResults(searchName, profiles);

    console.log('\n\n' + '='.repeat(60));
    console.log('📊 SCRAPING SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully scraped: ${profiles.length}/${profileUrls.length} profiles`);
    console.log(`📁 Saved to: ${filepath}`);
    console.log('');

    // Display all results
    if (profiles.length > 0) {
      console.log('📋 ALL SCRAPED PROFILES:\n');

      profiles.forEach((profile, index) => {
        console.log(`${index + 1}. ${profile.firstName} ${profile.lastName}`);
        console.log(`   LinkedIn: ${profile.publicIdentifier}`);
        console.log(`   Headline: ${profile.headline || 'N/A'}`);
        console.log(`   Location: ${profile.location || 'N/A'}`);

        if (profile.experience && profile.experience.length > 0) {
          console.log(`   Current Role: ${profile.experience[0].title} at ${profile.experience[0].company}`);
        }

        if (profile.skills && profile.skills.length > 0) {
          console.log(`   Top Skills: ${profile.skills.slice(0, 5).join(', ')}`);
        }

        console.log(`   Profile URL: ${profile.profileUrl}`);
        console.log('');
      });
    }

    // Statistics
    const stats = localStorage.getStats();
    console.log('='.repeat(60));
    console.log(`💾 Total profiles in local storage: ${stats.totalProfiles}`);
    console.log(`📂 Data directory: ./scraped-data/`);
    console.log('='.repeat(60));

    await scraper.close();
    console.log('\n✅ Scraping completed successfully!');

  } catch (error: any) {
    console.error('\n❌ Scraping failed:', error.message);
    console.error(error.stack);
    await scraper.close();
    process.exit(1);
  }
}

main();
