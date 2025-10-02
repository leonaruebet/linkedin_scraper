import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { LinkedInProfile } from '../types/linkedin';
import { localStorage } from '../services/local-storage-service';
import fs from 'fs';
import path from 'path';

interface ScraperConfig {
  maxWorkers: number;
  batchSize: number;
  delayMin: number;
  delayMax: number;
  maxRetries: number;
  checkpointInterval: number;
}

interface Checkpoint {
  searchQuery: string;
  totalTargets: number;
  completedCount: number;
  failedCount: number;
  profileUrls: string[];
  processedUrls: string[];
  failedUrls: string[];
  lastUpdated: string;
}

export class HighVolumeLinkedInScraper {
  private browsers: Browser[] = [];
  private contexts: BrowserContext[] = [];
  private config: ScraperConfig;
  private checkpoint: Checkpoint;
  private checkpointPath: string;

  constructor(
    private email: string = process.env.LINKEDIN_EMAIL || '',
    private password: string = process.env.LINKEDIN_PASSWORD || '',
    config?: Partial<ScraperConfig>
  ) {
    this.config = {
      maxWorkers: 3, // Run 3 browsers in parallel
      batchSize: 100, // Process 100 profiles per batch
      delayMin: 3000, // Min 3s delay between requests
      delayMax: 7000, // Max 7s delay
      maxRetries: 3,
      checkpointInterval: 50, // Save checkpoint every 50 profiles
      ...config
    };

    this.checkpointPath = path.join(process.cwd(), 'scraped-data', 'checkpoint.json');
    this.checkpoint = this.loadCheckpoint();
  }

  private loadCheckpoint(): Checkpoint {
    if (fs.existsSync(this.checkpointPath)) {
      const data = fs.readFileSync(this.checkpointPath, 'utf-8');
      console.log('📂 Checkpoint loaded - resuming from previous session');
      return JSON.parse(data);
    }

    return {
      searchQuery: '',
      totalTargets: 0,
      completedCount: 0,
      failedCount: 0,
      profileUrls: [],
      processedUrls: [],
      failedUrls: [],
      lastUpdated: new Date().toISOString()
    };
  }

  private saveCheckpoint(): void {
    this.checkpoint.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.checkpointPath, JSON.stringify(this.checkpoint, null, 2));
  }

  private clearCheckpoint(): void {
    if (fs.existsSync(this.checkpointPath)) {
      fs.unlinkSync(this.checkpointPath);
    }
  }

  async initializeWorkers(): Promise<void> {
    console.log(`🚀 Launching ${this.config.maxWorkers} browser workers...`);

    for (let i = 0; i < this.config.maxWorkers; i++) {
      const browser = await chromium.launch({
        headless: true, // Run headless for performance
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });

      this.browsers.push(browser);
      this.contexts.push(context);

      console.log(`✅ Worker ${i + 1} ready`);
    }
  }

  async loginAllWorkers(): Promise<void> {
    console.log('🔐 Logging in all workers...');

    const loginPromises = this.contexts.map(async (context, index) => {
      const page = await context.newPage();

      try {
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await this.delay(2000);

        await page.fill('#username', this.email);
        await page.fill('#password', this.password);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(5000);

        const url = page.url();
        if (url.includes('/feed') || url.includes('/in/')) {
          console.log(`✅ Worker ${index + 1} logged in`);
          await page.close();
          return true;
        } else {
          console.log(`⚠️  Worker ${index + 1} may need verification`);
          await page.close();
          return false;
        }
      } catch (error: any) {
        console.error(`❌ Worker ${index + 1} login failed:`, error.message);
        await page.close();
        return false;
      }
    });

    await Promise.all(loginPromises);
  }

  async collectProfileUrls(keywords: string, location: string | undefined, targetCount: number): Promise<string[]> {
    console.log(`\n🔍 Collecting up to ${targetCount} profile URLs...`);

    const allUrls: Set<string> = new Set();
    const context = this.contexts[0];
    const page = await context.newPage();

    try {
      let pageNum = 1;
      const maxPages = Math.ceil(targetCount / 10); // LinkedIn shows ~10 results per page

      while (allUrls.size < targetCount && pageNum <= maxPages) {
        const searchQuery = location ? `${keywords} ${location}` : keywords;
        const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(searchQuery)}&page=${pageNum}`;

        console.log(`📄 Page ${pageNum}/${maxPages} - Found ${allUrls.size} URLs so far...`);

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await this.delay(3000);

        // Scroll to load results
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          await this.delay(1000);
        }

        const pageUrls = await page.evaluate(() => {
          const urls: string[] = [];
          const selectors = [
            'a.app-aware-link[href*="/in/"]',
            'a[href*="/in/"]'
          ];

          for (const selector of selectors) {
            const links = document.querySelectorAll(selector);
            links.forEach((link) => {
              const href = (link as HTMLAnchorElement).href;
              if (href && href.includes('/in/') && !href.includes('/search') && !href.includes('/company')) {
                const cleanUrl = href.split('?')[0].replace(/\/$/, '');
                const match = cleanUrl.match(/https:\/\/[^\/]+\/in\/([^\/]+)/);
                if (match) {
                  urls.push(cleanUrl + '/');
                }
              }
            });
          }

          return [...new Set(urls)];
        });

        pageUrls.forEach(url => allUrls.add(url));

        if (pageUrls.length === 0) {
          console.log('⚠️  No more results found');
          break;
        }

        pageNum++;
        await this.delay(this.config.delayMin, this.config.delayMax);
      }

      await page.close();
      console.log(`✅ Collected ${allUrls.size} unique profile URLs`);
      return Array.from(allUrls).slice(0, targetCount);

    } catch (error: any) {
      console.error('❌ URL collection failed:', error.message);
      await page.close();
      return Array.from(allUrls);
    }
  }

  async scrapeProfile(page: Page, profileUrl: string, retryCount = 0): Promise<LinkedInProfile | null> {
    try {
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const profile = await page.evaluate((url) => {
        const getText = (selector: string): string => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || '';
        };

        const fullName = getText('h1') || '';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const headline = getText('.text-body-medium') || getText('[class*="headline"]') || '';
        const location = getText('.text-body-small') || getText('[class*="location"]') || '';

        const photoElement = document.querySelector('img[alt*="Photo"]') as HTMLImageElement;
        const photoUrl = photoElement?.src || '';

        const publicIdentifier = url.split('/in/')[1]?.replace('/', '') || '';

        const skills: string[] = [];
        const skillElements = document.querySelectorAll('[data-field="skill_card_skill_topic"] span');
        skillElements.forEach((skill, index) => {
          if (index < 10) {
            const skillText = skill.textContent?.trim();
            if (skillText && skillText.length < 50) {
              skills.push(skillText);
            }
          }
        });

        return { firstName, lastName, headline, location, photoUrl, publicIdentifier, skills };
      }, profileUrl);

      const linkedInProfile: LinkedInProfile = {
        linkedinId: profile.publicIdentifier,
        publicIdentifier: profile.publicIdentifier,
        firstName: profile.firstName,
        lastName: profile.lastName,
        headline: profile.headline,
        location: profile.location,
        photoUrl: profile.photoUrl,
        skills: profile.skills,
        profileUrl,
        scrapedAt: new Date(),
        lastUpdated: new Date(),
      };

      return linkedInProfile;

    } catch (error: any) {
      if (retryCount < this.config.maxRetries) {
        console.log(`   ⚠️  Retry ${retryCount + 1}/${this.config.maxRetries}`);
        await this.delay(2000);
        return this.scrapeProfile(page, profileUrl, retryCount + 1);
      }
      console.error(`   ❌ Failed after ${this.config.maxRetries} retries`);
      return null;
    }
  }

  async scrapeInParallel(profileUrls: string[]): Promise<LinkedInProfile[]> {
    const profiles: LinkedInProfile[] = [];
    const urlQueue = [...profileUrls];
    const workers = this.config.maxWorkers;

    console.log(`\n🔄 Starting parallel scraping with ${workers} workers...`);
    console.log(`📊 Total profiles to scrape: ${urlQueue.length}\n`);

    const workerTasks = Array.from({ length: workers }, async (_, workerIndex) => {
      const context = this.contexts[workerIndex];
      const page = await context.newPage();

      while (urlQueue.length > 0) {
        const url = urlQueue.shift();
        if (!url) break;

        const remaining = urlQueue.length;
        const progress = profileUrls.length - remaining;
        const percent = ((progress / profileUrls.length) * 100).toFixed(1);

        console.log(`[Worker ${workerIndex + 1}] [${progress}/${profileUrls.length}] (${percent}%) ${url.split('/in/')[1]}`);

        const profile = await this.scrapeProfile(page, url);

        if (profile) {
          localStorage.saveProfile(profile);
          profiles.push(profile);
          this.checkpoint.completedCount++;
          this.checkpoint.processedUrls.push(url);
        } else {
          this.checkpoint.failedCount++;
          this.checkpoint.failedUrls.push(url);
        }

        // Save checkpoint periodically
        if (this.checkpoint.completedCount % this.config.checkpointInterval === 0) {
          this.saveCheckpoint();
          console.log(`💾 Checkpoint saved (${this.checkpoint.completedCount} completed)`);
        }

        await this.delay(this.config.delayMin, this.config.delayMax);
      }

      await page.close();
    });

    await Promise.all(workerTasks);

    return profiles;
  }

  async scrapeHighVolume(keywords: string, location: string | undefined, targetCount: number): Promise<void> {
    const startTime = Date.now();

    try {
      // Initialize workers
      await this.initializeWorkers();
      await this.loginAllWorkers();

      // Resume from checkpoint if exists
      let profileUrls: string[];

      if (this.checkpoint.profileUrls.length > 0 && this.checkpoint.searchQuery === `${keywords} ${location || ''}`) {
        console.log(`\n📂 Resuming previous session...`);
        console.log(`   Already completed: ${this.checkpoint.completedCount}`);
        console.log(`   Failed: ${this.checkpoint.failedCount}`);

        // Filter out already processed URLs
        profileUrls = this.checkpoint.profileUrls.filter(
          url => !this.checkpoint.processedUrls.includes(url)
        );

        console.log(`   Remaining: ${profileUrls.length}\n`);
      } else {
        // Fresh start - collect URLs
        profileUrls = await this.collectProfileUrls(keywords, location, targetCount);

        this.checkpoint = {
          searchQuery: `${keywords} ${location || ''}`,
          totalTargets: profileUrls.length,
          completedCount: 0,
          failedCount: 0,
          profileUrls,
          processedUrls: [],
          failedUrls: [],
          lastUpdated: new Date().toISOString()
        };

        this.saveCheckpoint();
      }

      // Scrape in parallel
      const profiles = await this.scrapeInParallel(profileUrls);

      // Save final results
      const searchName = `${keywords}${location ? '_' + location : ''}_${Date.now()}`;
      const filepath = localStorage.saveSearchResults(searchName, profiles);

      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

      console.log('\n\n' + '='.repeat(80));
      console.log('🎉 HIGH-VOLUME SCRAPING COMPLETED');
      console.log('='.repeat(80));
      console.log(`✅ Successfully scraped: ${this.checkpoint.completedCount} profiles`);
      console.log(`❌ Failed: ${this.checkpoint.failedCount} profiles`);
      console.log(`⏱️  Time elapsed: ${elapsed} minutes`);
      console.log(`📁 Results saved to: ${filepath}`);
      console.log(`💾 Local storage: ${localStorage.getStats().totalProfiles} total profiles`);
      console.log('='.repeat(80));

      // Clear checkpoint on success
      this.clearCheckpoint();

    } catch (error: any) {
      console.error('\n❌ Scraping failed:', error.message);
      console.log('💾 Progress saved to checkpoint - you can resume later');
      this.saveCheckpoint();
    } finally {
      await this.closeAll();
    }
  }

  async closeAll(): Promise<void> {
    for (const browser of this.browsers) {
      await browser.close();
    }
    console.log('\n🔒 All browsers closed');
  }

  private async delay(minMs: number, maxMs?: number): Promise<void> {
    const ms = maxMs ? Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs : minMs;
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
