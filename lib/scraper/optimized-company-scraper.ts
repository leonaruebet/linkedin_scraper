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

export class OptimizedCompanyScraper {
  private browsers: Browser[] = [];
  private contexts: BrowserContext[] = [];
  private checkpointPath: string;
  private dataPath: string;

  constructor(
    private email: string = process.env.LINKEDIN_EMAIL || '',
    private password: string = process.env.LINKEDIN_PASSWORD || '',
    private maxWorkers: number = 5 // 5 workers for ~10 companies/min
  ) {
    const dataDir = path.join(process.cwd(), 'scraped-data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.checkpointPath = path.join(dataDir, 'optimized-company-checkpoint.json');
    this.dataPath = path.join(dataDir, 'companies-optimized.json');
  }

  private loadCheckpoint(): Checkpoint {
    if (fs.existsSync(this.checkpointPath)) {
      const data = fs.readFileSync(this.checkpointPath, 'utf-8');
      return JSON.parse(data);
    }
    return { completedUrls: [], totalUrls: 0, scrapedCount: 0, timestamp: new Date().toISOString() };
  }

  private saveCheckpoint(checkpoint: Checkpoint): void {
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
    console.log(`🚀 Launching ${this.maxWorkers} browser workers...`);

    const authStatePath = path.join(process.cwd(), 'scraped-data', 'linkedin-auth.json');

    // Check if we have saved auth state
    let storageState: any = undefined;
    let needsFreshLogin = false;

    if (fs.existsSync(authStatePath)) {
      console.log('📁 Found saved authentication state');
      const authData = fs.readFileSync(authStatePath, 'utf-8');
      storageState = JSON.parse(authData);

      // Validate the auth state by testing it
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
          console.log('✅ Saved authentication is valid');
        }
      } catch (error) {
        console.log('⚠️  Could not validate auth, will login fresh');
        needsFreshLogin = true;
        fs.unlinkSync(authStatePath);
      }

      await testBrowser.close();
    } else {
      needsFreshLogin = true;
    }

    if (needsFreshLogin) {
      // Login ONCE first with a visible browser for manual checkpoint solving
      console.log('🔐 Logging in to LinkedIn...');
      console.log('⚠️  IMPORTANT: If checkpoint appears, please solve it manually!');

      const loginBrowser = await chromium.launch({
        headless: false, // Visible browser for manual checkpoint solving
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

        console.log('⏳ Waiting for login...');

        // Wait for navigation after login (either to feed, checkpoint, or challenge)
        await Promise.race([
          loginPage.waitForURL('**/feed/**', { timeout: 30000 }).catch(() => {}),
          loginPage.waitForURL('**/checkpoint/**', { timeout: 30000 }).catch(() => {}),
          loginPage.waitForURL('**/challenge/**', { timeout: 30000 }).catch(() => {}),
          this.delay(30000) // Fallback: wait 30 seconds
        ]);

        const url = loginPage.url();
        console.log(`📍 Current URL after login: ${url}`);

        if (url.includes('/checkpoint') || url.includes('/challenge')) {
          console.log('⚠️  Security checkpoint detected!');
          console.log('📝 Please solve the checkpoint manually in the browser window...');
          console.log('⏳ Waiting 60 seconds for you to complete...');

          // Wait for manual solving
          await this.delay(60000);

          const finalUrl = loginPage.url();
          console.log(`📍 Final URL after checkpoint: ${finalUrl}`);

          // Accept updatePhoneNumber checkpoint if user skips it
          if (finalUrl.includes('/updatePhoneNumber')) {
            console.log('⏭️  Skipping phone number update checkpoint...');
            const skipButton = await loginPage.$('button:has-text("Skip")');
            if (skipButton) {
              await skipButton.click();
              await this.delay(3000);
            }
          }

          const verifiedUrl = loginPage.url();
          if (!verifiedUrl.includes('/feed') && !verifiedUrl.includes('linkedin.com/in/') && !verifiedUrl.includes('/mynetwork')) {
            console.log(`❌ Checkpoint not solved - URL: ${verifiedUrl}`);
            await loginBrowser.close();
            throw new Error('Manual checkpoint solving required');
          }
        } else if (!url.includes('/feed') && !url.includes('linkedin.com/in/') && !url.includes('/mynetwork')) {
          console.log(`❌ Login failed - URL: ${url}`);
          await loginBrowser.close();
          throw new Error('Login failed');
        }

        console.log('✅ Login successful');

        // Save the authenticated state for future use
        storageState = await loginContext.storageState();
        fs.writeFileSync(authStatePath, JSON.stringify(storageState, null, 2));
        console.log('💾 Authentication state saved for future runs');

        await loginBrowser.close();

      } catch (error: any) {
        console.error('❌ Login failed:', error.message);
        await loginBrowser.close();
        throw error;
      }
    } else {
      // Reload storage state for workers
      const authData = fs.readFileSync(authStatePath, 'utf-8');
      storageState = JSON.parse(authData);
    }

    // Now create all workers with the authenticated state
    console.log(`🚀 Creating ${this.maxWorkers} authenticated workers...`);

    for (let i = 0; i < this.maxWorkers; i++) {
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
      });

      // Create context with saved authentication
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        storageState: storageState
      });

      this.browsers.push(browser);
      this.contexts.push(context);
      console.log(`✅ Worker ${i + 1} ready`);
    }
  }

  async loginAllWorkers(): Promise<void> {
    // No longer needed - login happens in initialize()
    console.log('✅ All workers already authenticated');
  }

  /**
   * Validate if authentication is still valid
   */
  private async validateAuth(page: Page): Promise<boolean> {
    try {
      console.log('🔍 Validating authentication...');
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.delay(2000);

      const url = page.url();
      console.log(`   Current URL: ${url}`);

      const isValid = !url.includes('/login') && !url.includes('/checkpoint') && !url.includes('/authwall');

      if (isValid) {
        console.log('✅ Authentication is valid');
      } else {
        console.log('❌ Authentication expired or checkpoint detected');
      }

      return isValid;
    } catch (error: any) {
      console.error(`❌ Auth validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * PHASE 1: Collect all company URLs from all pages (FAST - No scraping yet)
   */
  async collectAllCompanyUrls(
    searchQuery: string,
    locationGeoId: string,
    companySizes: string[],
    limit: number
  ): Promise<string[]> {
    console.log('\n📋 PHASE 1: Collecting all company URLs...');
    console.log(`   Query: ${searchQuery}`);
    console.log(`   Location: Thailand (${locationGeoId})`);
    console.log(`   Company Sizes: ${companySizes.join(', ')}`);
    console.log(`   Target: ${limit} companies\n`);

    const context = this.contexts[0];
    const page = await context.newPage();
    let companyUrls: string[] = [];
    let pageNum = 1;
    const maxPages = Math.ceil(limit / 10);

    // Load checkpoint for Phase 1 URL collection
    const urlCheckpointPath = path.join(process.cwd(), 'scraped-data', 'phase1-urls-checkpoint.json');
    if (fs.existsSync(urlCheckpointPath)) {
      const checkpoint = JSON.parse(fs.readFileSync(urlCheckpointPath, 'utf-8'));
      companyUrls = checkpoint.urls || [];
      pageNum = checkpoint.lastPage + 1 || 1;
      console.log(`📂 Resuming from checkpoint: Page ${pageNum}, ${companyUrls.length} URLs collected\n`);
    }

    try {
      // First, validate authentication
      const isValid = await this.validateAuth(page);
      if (!isValid) {
        console.log('❌ Authentication invalid! Deleting auth state...');
        const authStatePath = path.join(process.cwd(), 'scraped-data', 'linkedin-auth.json');
        if (fs.existsSync(authStatePath)) {
          fs.unlinkSync(authStatePath);
          console.log('🗑️  Deleted stale authentication state');
          console.log('⚠️  Please re-run the script to login again');
        }
        await page.close();
        return [];
      }

      while (companyUrls.length < limit && pageNum <= maxPages) {
        // Build LinkedIn search URL with proper filters
        // companyHqGeo=["105146118"] = Thailand
        // companySize=["C","D","E"] = 11-50, 51-200, 201-500
        // keywords = search query
        const searchUrl = `https://www.linkedin.com/search/results/companies/?` +
          `companyHqGeo=%5B%22105146118%22%5D&` +
          `companySize=%5B%22C%22%2C%22D%22%2C%22E%22%5D&` +
          `keywords=%22tech%22%20OR%20%22software%22%20OR%20%22finance%22%20OR%20%22ai%22%20OR%20%22food%22&` +
          `origin=FACETED_SEARCH&` +
          `page=${pageNum}`;

        console.log(`📄 Page ${pageNum}/${maxPages} - Collected ${companyUrls.length}/${limit} URLs...`);

        // Infinite retry with longer waits for rate limits
        let pageLoaded = false;
        let attempt = 0;

        while (!pageLoaded) {
          try {
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            pageLoaded = true;
          } catch (error: any) {
            attempt++;
            // Progressive backoff: 60s, 90s, 120s, 180s, 300s (5min max)
            const baseWait = attempt <= 3 ? 60000 * attempt : (attempt === 4 ? 180000 : 300000);
            const randomness = Math.floor(Math.random() * 10000); // Add 0-10s random
            const waitTime = baseWait + randomness;
            console.log(`   ⚠️  Page load failed (attempt ${attempt}), waiting ${Math.floor(waitTime/1000)}s...`);
            await this.delay(waitTime);
            // Never give up - keep retrying forever
          }
        }

        await this.delay(3000);

        // DEBUG: Check if we're logged in
        const currentUrl = page.url();
        console.log(`   Current URL: ${currentUrl}`);

        if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
          console.log('   ⚠️  Not logged in or hit checkpoint!');
          break;
        }

        // Scroll to load all results on page
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          await this.delay(800);
        }

        // Extract company URLs from page
        const pageUrls = await page.evaluate(() => {
          const urls: string[] = [];
          const links = document.querySelectorAll('a[href*="/company/"]');

          console.log(`Found ${links.length} links with /company/ in href`);

          links.forEach((link) => {
            const href = (link as HTMLAnchorElement).href;
            if (href && href.includes('/company/') && !href.includes('/search/')) {
              const cleanUrl = href.split('?')[0].replace(/\/$/, '') + '/';
              const match = cleanUrl.match(/\/company\/([^\/]+)/);
              if (match && !urls.includes(cleanUrl)) {
                urls.push(cleanUrl);
              }
            }
          });

          return [...new Set(urls)];
        });

        console.log(`   Extracted ${pageUrls.length} unique company URLs from page`);

        pageUrls.forEach(url => {
          if (!companyUrls.includes(url) && companyUrls.length < limit) {
            companyUrls.push(url);
          }
        });

        // Don't stop on empty pages - continue to maxPages to get full 5500 URLs
        pageNum++;

        // Save checkpoint after EVERY page
        fs.writeFileSync(urlCheckpointPath, JSON.stringify({
          lastPage: pageNum,
          urls: companyUrls,
          timestamp: new Date().toISOString()
        }, null, 2));
        console.log(`   💾 Checkpoint saved (${companyUrls.length} URLs)`);

        await this.delay(10000, 15000); // Longer delay between pages to avoid rate limits
      }

      await page.close();

      // Save final checkpoint
      fs.writeFileSync(urlCheckpointPath, JSON.stringify({
        lastPage: pageNum,
        urls: companyUrls,
        timestamp: new Date().toISOString(),
        completed: true
      }, null, 2));

      console.log(`\n✅ PHASE 1 COMPLETE: Collected ${companyUrls.length} company URLs\n`);
      return companyUrls.slice(0, limit);

    } catch (error: any) {
      await page.close();
      console.error('❌ URL collection failed:', error.message);

      // Save checkpoint on error
      fs.writeFileSync(urlCheckpointPath, JSON.stringify({
        lastPage: pageNum,
        urls: companyUrls,
        timestamp: new Date().toISOString(),
        error: error.message
      }, null, 2));

      return companyUrls;
    }
  }

  /**
   * PHASE 2: Scrape all companies in parallel with checkpoints
   */
  async scrapeCompaniesParallel(companyUrls: string[]): Promise<CompanyProfile[]> {
    console.log(`\n📊 PHASE 2: Scraping ${companyUrls.length} companies in parallel...`);

    const checkpoint = this.loadCheckpoint();
    const remainingUrls = companyUrls.filter(url => !checkpoint.completedUrls.includes(url));

    if (remainingUrls.length === 0) {
      console.log('✅ All companies already scraped!');
      return [];
    }

    console.log(`   Remaining: ${remainingUrls.length} companies`);
    console.log(`   Already completed: ${checkpoint.completedUrls.length} companies\n`);

    const companies: CompanyProfile[] = [];
    const urlQueue = [...remainingUrls];

    const workerTasks = this.contexts.map(async (context, workerIndex) => {
      const page = await context.newPage();
      let consecutiveFailures = 0;

      while (urlQueue.length > 0) {
        const url = urlQueue.shift();
        if (!url) break;

        // Validate auth every 50 companies or after 3 consecutive failures
        if (consecutiveFailures >= 3 || checkpoint.completedUrls.length % 50 === 0) {
          const isValid = await this.validateAuth(page);
          if (!isValid) {
            console.log(`\n[Worker ${workerIndex + 1}] ⚠️  Authentication expired!`);
            console.log('🗑️  Deleting stale auth state...');

            const authStatePath = path.join(process.cwd(), 'scraped-data', 'linkedin-auth.json');
            if (fs.existsSync(authStatePath)) {
              fs.unlinkSync(authStatePath);
            }

            console.log('⚠️  Stopping scraper - please re-run to login again');
            await page.close();
            return;
          }
          consecutiveFailures = 0;
        }

        const remaining = urlQueue.length;
        const progress = companyUrls.length - remaining;
        const percent = ((progress / companyUrls.length) * 100).toFixed(1);

        console.log(`[Worker ${workerIndex + 1}] [${progress}/${companyUrls.length}] (${percent}%)`);

        try {
          const company = await this.scrapeCompany(page, url);
          if (company) {
            consecutiveFailures = 0; // Reset on success
            companies.push(company);
            this.saveCompany(company);

            // Update checkpoint
            checkpoint.completedUrls.push(url);
            checkpoint.scrapedCount = checkpoint.completedUrls.length;
            checkpoint.timestamp = new Date().toISOString();

            // Save checkpoint every 5 companies (more frequent saves)
            if (checkpoint.completedUrls.length % 5 === 0) {
              this.saveCheckpoint(checkpoint);
            }
          } else {
            consecutiveFailures++;
            console.log(`   ⚠️  No data returned (${consecutiveFailures} consecutive failures)`);
          }
        } catch (error: any) {
          consecutiveFailures++;
          console.error(`   ❌ Failed: ${error.message}`);
        }

        await this.delay(17000, 60000); // ~1-3.5 companies/min (17-60s between companies) - safer delays
      }

      await page.close();
    });

    await Promise.all(workerTasks);

    // Save final checkpoint
    this.saveCheckpoint(checkpoint);

    console.log(`\n✅ PHASE 2 COMPLETE: Scraped ${companies.length} companies\n`);
    return companies;
  }

  private async scrapeCompany(page: Page, companyUrl: string): Promise<CompanyProfile | null> {
    try {
      const aboutUrl = companyUrl.replace(/\/$/, '') + '/about/';
      await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.delay(3000);

      // Check if redirected to login/checkpoint/authwall
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint') || currentUrl.includes('/authwall')) {
        console.log(`   🚨 CHECKPOINT DETECTED: ${currentUrl}`);
        console.log(`   ⏸️  Pausing for 5 minutes to avoid further detection...`);

        // Wait 5 minutes before continuing
        await this.delay(300000, 300000); // 5 minutes

        console.log(`   ⚠️  Checkpoint detected - this company will be skipped`);
        console.log(`   💡 TIP: If checkpoints keep appearing, the account may be flagged`);
        return null;
      }

      // Slower scrolling to avoid errors
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

        // Primary method: dt h3 labels
        const allDts = document.querySelectorAll('dt h3');
        allDts.forEach((dtH3) => {
          const label = dtH3.textContent?.trim().toLowerCase() || '';
          let current = dtH3.parentElement?.nextElementSibling;

          while (current && current.tagName === 'DD') {
            const ddText = current.textContent?.trim() || '';

            if (label.includes('website') || label.includes('เว็บไซต์')) {
              const link = current.querySelector('a');
              if (link) website = link.href;
              break;
            } else if (label.includes('phone') || label.includes('โทรศัพท์')) {
              const phoneMatch = ddText.match(/[\+\d\s\(\)\-]+/);
              phone = phoneMatch ? phoneMatch[0].trim() : ddText.split('\n')[0].trim();
              break;
            } else if (label.includes('industry') || label.includes('อุตสาหกรรม')) {
              industry = ddText;
              break;
            } else if (label.includes('company size') || label.includes('ขนาดบริษัท')) {
              const sizeMatch = ddText.match(/([\d,]+[-–][\d,]+|[\d,]+\+)/);
              if (sizeMatch) companySize = sizeMatch[1];
              break;
            } else if (label.includes('headquarters') || label.includes('สำนักงานใหญ่')) {
              headquarters = ddText.split('\n')[0].trim();
              break;
            } else if (label.includes('type') || label.includes('ประเภท')) {
              companyType = ddText;
              break;
            } else if (label.includes('founded') || label.includes('ก่อตั้ง')) {
              const yearMatch = ddText.match(/\d{4}/);
              if (yearMatch) founded = yearMatch[0];
              break;
            } else if (label.includes('specialties') || label.includes('ความเชี่ยวชาญ')) {
              specialties = ddText.split(',').map(s => s.trim()).filter(s => s.length > 0);
              break;
            }

            current = current.nextElementSibling;
          }
        });

        // Fallback: Try alternative selectors for website and phone
        if (!website) {
          // Try finding website link in page
          const websiteLinks = Array.from(document.querySelectorAll('a')).filter(a => {
            const href = a.href;
            const text = a.textContent?.toLowerCase() || '';
            return href && !href.includes('linkedin.com') &&
                   (text.includes('website') || text.includes('visit') ||
                    a.className.includes('link-without-visited-state'));
          });
          if (websiteLinks.length > 0) {
            website = websiteLinks[0].href;
          }
        }

        if (!phone) {
          // Try finding phone in any dd element
          const allDds = Array.from(document.querySelectorAll('dd'));
          for (const dd of allDds) {
            const text = dd.textContent?.trim() || '';
            // Look for phone number patterns
            const phonePattern = /(\+?\d{1,4}[\s\-]?)?\(?\d{1,4}\)?[\s\-]?\d{1,4}[\s\-]?\d{1,9}/;
            const match = text.match(phonePattern);
            if (match && match[0].length >= 8) {
              phone = match[0].trim();
              break;
            }
          }
        }

        const universalName = url.split('/company/')[1]?.replace(/\/$/, '').split('/')[0] || '';

        return {
          name, universalName, tagline, description, website, phone,
          industry, companySize, companyType, founded, headquarters, specialties
        };
      }, companyUrl);

      const employeeCount = this.parseEmployeeCount(companyData.companySize);

      // Extract email from website
      let email = '';
      if (companyData.website) {
        email = await this.extractEmailFromWebsite(page, companyData.website);
      }

      return {
        companyId: companyData.universalName,
        name: companyData.name,
        universalName: companyData.universalName,
        tagline: companyData.tagline,
        description: companyData.description,
        website: companyData.website,
        phone: companyData.phone,
        email: email,
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

  private async extractEmailFromWebsite(page: Page, websiteUrl: string): Promise<string> {
    try {
      const response = await page.goto(websiteUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      if (!response || !response.ok()) return '';

      const emails = await page.evaluate(() => {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const text = document.body.textContent || '';
        const matches = text.match(emailRegex);

        if (matches) {
          // Filter out common non-contact emails
          return matches.filter(email =>
            !email.includes('example.com') &&
            !email.includes('sentry.io') &&
            !email.includes('google') &&
            !email.includes('facebook') &&
            !email.includes('wixpress.com')
          );
        }
        return [];
      });

      // Return first valid email found
      return emails && emails.length > 0 ? emails[0] : '';

    } catch (error) {
      return '';
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

  async closeAll(): Promise<void> {
    for (const browser of this.browsers) {
      await browser.close();
    }
    console.log('🔒 All browsers closed');
  }

  private async delay(minMs: number, maxMs?: number): Promise<void> {
    const ms = maxMs ? Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs : minMs;
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
