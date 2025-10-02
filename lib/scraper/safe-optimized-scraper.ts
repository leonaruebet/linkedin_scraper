import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { CompanyProfile } from './company-scraper';
import fs from 'fs';
import path from 'path';

interface Checkpoint {
  completedUrls: string[];
  totalUrls: number;
  scrapedCount: number;
  timestamp: string;
}

/**
 * SAFE SCRAPER - Single Account with Smart Rate Limiting
 *
 * Strategy:
 * - 1 browser, 1 context (looks like normal human browsing)
 * - Random delays between requests (30-60s)
 * - Daily limits (max 100 companies/day)
 * - Auto-pause every 2 hours
 * - Checkpoint after every company
 */
export class SafeOptimizedScraper {
  private browser?: Browser;
  private context?: BrowserContext;
  private checkpointPath: string;
  private dataPath: string;
  private startTime: Date;
  private companiesScrapedToday = 0;
  private readonly DAILY_LIMIT = 100;
  private readonly SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours
  private readonly MIN_DELAY = 30000; // 30 seconds
  private readonly MAX_DELAY = 60000; // 60 seconds

  constructor(
    private email: string = process.env.LINKEDIN_EMAIL || '',
    private password: string = process.env.LINKEDIN_PASSWORD || ''
  ) {
    const dataDir = path.join(process.cwd(), 'scraped-data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.checkpointPath = path.join(dataDir, 'safe-scraper-checkpoint.json');
    this.dataPath = path.join(dataDir, 'companies-safe.json');
    this.startTime = new Date();
  }

  private loadCheckpoint(): Checkpoint {
    if (fs.existsSync(this.checkpointPath)) {
      const data = fs.readFileSync(this.checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(data);

      // Reset daily counter if it's a new day
      const lastRun = new Date(checkpoint.timestamp);
      const today = new Date();
      if (lastRun.toDateString() !== today.toDateString()) {
        checkpoint.dailyCount = 0;
      }

      this.companiesScrapedToday = checkpoint.dailyCount || 0;
      return checkpoint;
    }
    return {
      completedUrls: [],
      totalUrls: 0,
      scrapedCount: 0,
      timestamp: new Date().toISOString(),
      dailyCount: 0
    };
  }

  private saveCheckpoint(checkpoint: Checkpoint): void {
    checkpoint.dailyCount = this.companiesScrapedToday;
    fs.writeFileSync(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
  }

  private saveCompany(company: CompanyProfile): void {
    let companies: CompanyProfile[] = [];
    if (fs.existsSync(this.dataPath)) {
      const data = fs.readFileSync(this.dataPath, 'utf-8');
      companies = JSON.parse(data);
    }

    const index = companies.findIndex(c => c.companyId === company.companyId);
    if (index >= 0) {
      companies[index] = company;
    } else {
      companies.push(company);
    }

    fs.writeFileSync(this.dataPath, JSON.stringify(companies, null, 2));
  }

  async initialize(): Promise<void> {
    console.log('🐢 SAFE SCRAPER - Slow & Steady');
    console.log('═'.repeat(60));
    console.log('⚙️  Settings:');
    console.log(`   Daily Limit: ${this.DAILY_LIMIT} companies`);
    console.log(`   Delay Between Companies: ${this.MIN_DELAY/1000}-${this.MAX_DELAY/1000}s`);
    console.log(`   Session Duration: 2 hours`);
    console.log(`   Already scraped today: ${this.companiesScrapedToday}`);
    console.log('═'.repeat(60));

    const authStatePath = path.join(process.cwd(), 'scraped-data', 'linkedin-auth-safe.json');

    let storageState: any = undefined;
    let needsFreshLogin = false;

    if (fs.existsSync(authStatePath)) {
      console.log('\n📁 Found saved authentication state');
      const authData = fs.readFileSync(authStatePath, 'utf-8');
      storageState = JSON.parse(authData);

      console.log('🔍 Validating saved authentication...');
      const testBrowser = await chromium.launch({ headless: true });
      const testContext = await testBrowser.newContext({ storageState });
      const testPage = await testContext.newPage();

      try {
        await testPage.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.delay(2000);
        const url = testPage.url();

        if (url.includes('/login') || url.includes('/checkpoint') || url.includes('/authwall')) {
          console.log('❌ Saved authentication is invalid');
          needsFreshLogin = true;
          fs.unlinkSync(authStatePath);
        } else {
          console.log('✅ Saved authentication is valid\n');
        }
      } catch (error) {
        console.log('⚠️  Could not validate auth, will login fresh');
        needsFreshLogin = true;
        if (fs.existsSync(authStatePath)) fs.unlinkSync(authStatePath);
      }

      await testBrowser.close();
    } else {
      needsFreshLogin = true;
    }

    if (needsFreshLogin) {
      console.log('\n🔐 Logging in to LinkedIn...');
      console.log('⚠️  IMPORTANT: If checkpoint appears, please solve it manually!\n');

      const loginBrowser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
      });

      const loginContext = await loginBrowser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });

      const loginPage = await loginContext.newPage();

      try {
        await loginPage.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await this.delay(2000);

        await loginPage.fill('#username', this.email);
        await loginPage.fill('#password', this.password);
        await loginPage.click('button[type="submit"]');

        console.log('⏳ Waiting for login... (60 seconds for manual checkpoint solving)');
        await this.delay(10000);

        const url = loginPage.url();

        if (url.includes('/checkpoint') || url.includes('/challenge')) {
          console.log('⚠️  Security checkpoint detected!');
          console.log('📝 Please solve the checkpoint manually in the browser window...');
          console.log('⏳ Waiting 120 seconds for you to complete...\n');

          await this.delay(120000);

          const finalUrl = loginPage.url();
          if (!finalUrl.includes('/feed')) {
            console.log(`❌ Checkpoint not solved - URL: ${finalUrl}`);
            await loginBrowser.close();
            throw new Error('Manual checkpoint solving required');
          }
        } else if (!url.includes('/feed')) {
          console.log(`❌ Login failed - URL: ${url}`);
          await loginBrowser.close();
          throw new Error('Login failed');
        }

        console.log('✅ Login successful\n');

        storageState = await loginContext.storageState();
        fs.writeFileSync(authStatePath, JSON.stringify(storageState, null, 2));
        console.log('💾 Authentication state saved for future runs\n');

        await loginBrowser.close();

      } catch (error: any) {
        console.error('❌ Login failed:', error.message);
        await loginBrowser.close();
        throw error;
      }
    } else {
      const authData = fs.readFileSync(authStatePath, 'utf-8');
      storageState = JSON.parse(authData);
    }

    // Create single browser with saved auth
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      storageState: storageState
    });

    console.log('✅ Browser initialized\n');
  }

  async scrapeCompaniesSafely(companyUrls: string[]): Promise<CompanyProfile[]> {
    if (!this.context) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    console.log(`\n📊 Starting safe scraping session...`);
    console.log(`   Total companies: ${companyUrls.length}`);
    console.log(`   Daily limit remaining: ${this.DAILY_LIMIT - this.companiesScrapedToday}\n`);

    const checkpoint = this.loadCheckpoint();
    const remainingUrls = companyUrls.filter(url => !checkpoint.completedUrls.includes(url));

    if (remainingUrls.length === 0) {
      console.log('✅ All companies already scraped!\n');
      return [];
    }

    const companies: CompanyProfile[] = [];
    const page = await this.context.newPage();

    for (let i = 0; i < remainingUrls.length; i++) {
      // Check daily limit
      if (this.companiesScrapedToday >= this.DAILY_LIMIT) {
        console.log('\n⏸️  DAILY LIMIT REACHED');
        console.log(`   Scraped today: ${this.companiesScrapedToday}/${this.DAILY_LIMIT}`);
        console.log('   Resume tomorrow to continue!\n');
        break;
      }

      // Check session duration (auto-pause every 2 hours)
      const now = new Date();
      const elapsed = now.getTime() - this.startTime.getTime();
      if (elapsed > this.SESSION_DURATION) {
        console.log('\n⏸️  SESSION TIMEOUT (2 hours)');
        console.log('   Taking a break to avoid detection...');
        console.log('   Resume in a few hours!\n');
        break;
      }

      const url = remainingUrls[i];
      const progress = checkpoint.completedUrls.length + i + 1;
      const percent = ((progress / companyUrls.length) * 100).toFixed(1);

      console.log(`[${progress}/${companyUrls.length}] (${percent}%) - ${url}`);

      try {
        const company = await this.scrapeCompany(page, url);

        if (company) {
          companies.push(company);
          this.saveCompany(company);
          this.companiesScrapedToday++;

          checkpoint.completedUrls.push(url);
          checkpoint.scrapedCount = checkpoint.completedUrls.length;
          checkpoint.timestamp = new Date().toISOString();
          this.saveCheckpoint(checkpoint);

          console.log(`   ✅ Scraped: ${company.name}`);
        } else {
          console.log(`   ⚠️  No data returned`);
        }
      } catch (error: any) {
        console.error(`   ❌ Failed: ${error.message}`);
      }

      // Random human-like delay
      const delay = Math.floor(Math.random() * (this.MAX_DELAY - this.MIN_DELAY + 1)) + this.MIN_DELAY;
      console.log(`   ⏳ Waiting ${Math.floor(delay/1000)}s before next company...\n`);
      await this.delay(delay);
    }

    await page.close();

    console.log('\n✅ Scraping session complete!');
    console.log(`   Companies scraped: ${companies.length}`);
    console.log(`   Total scraped today: ${this.companiesScrapedToday}/${this.DAILY_LIMIT}\n`);

    return companies;
  }

  private async scrapeCompany(page: Page, companyUrl: string): Promise<CompanyProfile | null> {
    try {
      const aboutUrl = companyUrl.replace(/\/$/, '') + '/about/';
      await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.delay(3000);

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint') || currentUrl.includes('/authwall')) {
        console.log(`   ⚠️  Auth wall detected: ${currentUrl}`);
        return null;
      }

      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await this.delay(800);
      }

      const companyData = await page.evaluate((url: string) => {
        const getText = (selector: string): string => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || '';
        };

        const name = getText('h1.org-top-card-summary__title') || getText('h1') || '';
        const tagline = getText('.org-top-card-summary__tagline') || '';
        const description = getText('.org-about-us-organization-description__text') || '';

        let industry = '', companySize = '', headquarters = '', founded = '';
        let companyType = '', specialties: string[] = [], website = '', phone = '';

        const allDts = document.querySelectorAll('dt h3');
        allDts.forEach((dtH3) => {
          const label = dtH3.textContent?.trim().toLowerCase() || '';
          let current = dtH3.parentElement?.nextElementSibling;

          while (current && current.tagName === 'DD') {
            const ddText = current.textContent?.trim() || '';

            if (label.includes('website')) {
              const link = current.querySelector('a');
              if (link) website = link.href;
              break;
            } else if (label.includes('phone')) {
              const phoneMatch = ddText.match(/[\+\d\s\(\)\-]+/);
              phone = phoneMatch ? phoneMatch[0].trim() : ddText.split('\n')[0].trim();
              break;
            } else if (label.includes('industry')) {
              industry = ddText;
              break;
            } else if (label.includes('company size')) {
              const sizeMatch = ddText.match(/([\d,]+[-–][\d,]+|[\d,]+\+)/);
              if (sizeMatch) companySize = sizeMatch[1];
              break;
            } else if (label.includes('headquarters')) {
              headquarters = ddText.split('\n')[0].trim();
              break;
            } else if (label.includes('type')) {
              companyType = ddText;
              break;
            } else if (label.includes('founded')) {
              const yearMatch = ddText.match(/\d{4}/);
              if (yearMatch) founded = yearMatch[0];
              break;
            } else if (label.includes('specialties')) {
              specialties = ddText.split(',').map(s => s.trim()).filter(s => s.length > 0);
              break;
            }

            current = current.nextElementSibling;
          }
        });

        const universalName = url.split('/company/')[1]?.replace(/\/$/, '').split('/')[0] || '';

        return {
          name, universalName, tagline, description, website, phone,
          industry, companySize, companyType, founded, headquarters, specialties
        };
      }, companyUrl);

      if (!companyData.name || companyData.name.includes('Join LinkedIn') || companyData.name.includes('Welcome Back')) {
        return null;
      }

      const employeeCount = this.parseEmployeeCount(companyData.companySize);

      return {
        companyId: companyData.universalName,
        name: companyData.name,
        universalName: companyData.universalName,
        tagline: companyData.tagline,
        description: companyData.description,
        website: companyData.website,
        phone: companyData.phone,
        email: '',
        industry: companyData.industry,
        companySize: companyData.companySize,
        employeeCount,
        companyType: companyData.companyType,
        founded: companyData.founded,
        headquarters: companyData.headquarters,
        locations: [],
        linkedinUrl: companyUrl,
        followerCount: 0,
        specialties: companyData.specialties,
        logoUrl: '',
        coverImageUrl: '',
        scrapedAt: new Date()
      };

    } catch (error) {
      return null;
    }
  }

  private parseEmployeeCount(companySize: string): number | undefined {
    if (!companySize) return undefined;

    const match = companySize.match(/([\d,]+)[-–]([\d,]+)/);
    if (match) {
      const min = parseInt(match[1].replace(/,/g, ''));
      const max = parseInt(match[2].replace(/,/g, ''));
      return Math.floor((min + max) / 2);
    }

    if (companySize.includes('10,001+')) return 15000;
    if (companySize.includes('5,001-10,000')) return 7500;
    if (companySize.includes('1,001-5,000')) return 3000;

    return undefined;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Browser closed\n');
    }
  }

  private async delay(minMs: number, maxMs?: number): Promise<void> {
    const ms = maxMs ? Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs : minMs;
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
