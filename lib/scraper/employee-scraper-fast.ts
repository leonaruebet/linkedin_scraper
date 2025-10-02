import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

export interface EmployeeProfileWithContact {
  employeeId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  headline: string;
  currentTitle: string;
  currentCompany: string;
  companyLinkedInUrl: string;
  location: string;
  profileUrl: string;
  photoUrl: string;

  // Contact info
  email?: string;
  phone?: string;

  // Job details
  department?: string;
  seniorityLevel?: string;

  // Metadata
  scrapedAt: Date;
}

interface Checkpoint {
  completedCompanies: string[];
  totalEmployees: number;
  timestamp: string;
}

interface ProxyConfig {
  server: string;      // 'http://proxy-server:port'
  username?: string;   // Optional proxy auth
  password?: string;
}

/**
 * Fast Employee Scraper with Proxy Support
 *
 * Features:
 * - Proxy rotation for speed & avoiding bans
 * - Only 4 employees per company
 * - Attempts to extract email & phone
 * - Parallel execution possible with proxies
 */
export class FastEmployeeScraper {
  private browsers: Browser[] = [];
  private contexts: BrowserContext[] = [];
  private checkpointPath: string;
  private dataPath: string;

  private readonly TARGET_TITLES = [
    'sales', 'business development', 'account manager',
    'sales manager', 'sales director', 'vp sales',
    'marketing manager', 'marketing director', 'cmo',
    'manager', 'director', 'head of', 'vp',
    'ceo', 'cto', 'cfo', 'founder', 'president'
  ];

  constructor(
    private email: string = process.env.LINKEDIN_EMAIL || '',
    private password: string = process.env.LINKEDIN_PASSWORD || '',
    private proxies: ProxyConfig[] = [],
    private employeesPerCompany: number = 4
  ) {
    const dataDir = path.join(process.cwd(), 'scraped-data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.checkpointPath = path.join(dataDir, 'fast-employee-checkpoint.json');
    this.dataPath = path.join(dataDir, 'employees-with-contact.json');
  }

  private loadCheckpoint(): Checkpoint {
    if (fs.existsSync(this.checkpointPath)) {
      return JSON.parse(fs.readFileSync(this.checkpointPath, 'utf-8'));
    }
    return {
      completedCompanies: [],
      totalEmployees: 0,
      timestamp: new Date().toISOString()
    };
  }

  private saveCheckpoint(checkpoint: Checkpoint): void {
    fs.writeFileSync(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
  }

  private saveEmployees(employees: EmployeeProfileWithContact[]): void {
    let allEmployees: EmployeeProfileWithContact[] = [];
    if (fs.existsSync(this.dataPath)) {
      allEmployees = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'));
    }

    employees.forEach(emp => {
      const index = allEmployees.findIndex(e => e.employeeId === emp.employeeId);
      if (index >= 0) {
        allEmployees[index] = emp;
      } else {
        allEmployees.push(emp);
      }
    });

    fs.writeFileSync(this.dataPath, JSON.stringify(allEmployees, null, 2));
  }

  async initialize(): Promise<void> {
    console.log('⚡ FAST EMPLOYEE SCRAPER WITH PROXY');
    console.log('═'.repeat(60));
    console.log(`🎯 Target: ${this.employeesPerCompany} employees per company`);
    console.log('📧 Will attempt to extract email & phone');

    if (this.proxies.length > 0) {
      console.log(`🌐 Using ${this.proxies.length} proxies for rotation`);
      console.log('   Proxies:');
      this.proxies.forEach((p, i) => console.log(`     ${i + 1}. ${p.server}`));
    } else {
      console.log('⚠️  No proxies configured - using direct connection');
      console.log('   Add proxies to .env.local for faster scraping:');
      console.log('   PROXY_1=http://proxy1:port');
      console.log('   PROXY_1_USER=username');
      console.log('   PROXY_1_PASS=password');
    }
    console.log('═'.repeat(60));

    const authStatePath = path.join(process.cwd(), 'scraped-data', 'linkedin-auth-fast.json');

    // Login once without proxy to get auth
    let storageState: any = undefined;
    let needsFreshLogin = !fs.existsSync(authStatePath);

    if (!needsFreshLogin) {
      console.log('\n📁 Found saved authentication');
      storageState = JSON.parse(fs.readFileSync(authStatePath, 'utf-8'));
    } else {
      console.log('\n🔐 Logging in to LinkedIn...');

      const loginBrowser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
      });

      const loginContext = await loginBrowser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });

      const loginPage = await loginContext.newPage();

      await loginPage.goto('https://www.linkedin.com/login');
      await this.delay(2000);

      await loginPage.fill('#username', this.email);
      await loginPage.fill('#password', this.password);
      await loginPage.click('button[type="submit"]');

      console.log('⏳ Waiting for login (solve checkpoint if appears)...');
      await this.delay(10000);

      const url = loginPage.url();
      if (url.includes('/checkpoint')) {
        console.log('⚠️  Checkpoint detected - waiting 120s...');
        await this.delay(120000);
      }

      storageState = await loginContext.storageState();
      fs.writeFileSync(authStatePath, JSON.stringify(storageState, null, 2));
      console.log('✅ Login successful\n');

      await loginBrowser.close();
    }

    // Create workers (with or without proxies)
    const workerCount = this.proxies.length > 0 ? this.proxies.length : 1;
    console.log(`\n🚀 Creating ${workerCount} workers...\n`);

    for (let i = 0; i < workerCount; i++) {
      const proxy = this.proxies[i];

      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
        proxy: proxy ? { server: proxy.server } : undefined
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        storageState,
        httpCredentials: proxy && proxy.username ? {
          username: proxy.username,
          password: proxy.password || ''
        } : undefined
      });

      this.browsers.push(browser);
      this.contexts.push(context);

      if (proxy) {
        console.log(`✅ Worker ${i + 1} ready with proxy ${proxy.server}`);
      } else {
        console.log(`✅ Worker ${i + 1} ready (no proxy)`);
      }
    }
  }

  async scrapeEmployeesParallel(companyUrls: string[]): Promise<void> {
    console.log(`\n📊 Starting parallel scraping...`);
    console.log(`   Companies: ${companyUrls.length}`);
    console.log(`   Workers: ${this.contexts.length}\n`);

    const checkpoint = this.loadCheckpoint();
    const remaining = companyUrls.filter(url => !checkpoint.completedCompanies.includes(url));

    if (remaining.length === 0) {
      console.log('✅ All companies scraped!\n');
      return;
    }

    console.log(`   Remaining: ${remaining.length}\n`);

    const urlQueue = [...remaining];

    // Run workers in parallel
    const workerTasks = this.contexts.map(async (context, workerIndex) => {
      const page = await context.newPage();

      while (urlQueue.length > 0) {
        const url = urlQueue.shift();
        if (!url) break;

        const progress = checkpoint.completedCompanies.length + (remaining.length - urlQueue.length);
        const percent = ((progress / companyUrls.length) * 100).toFixed(1);

        console.log(`[Worker ${workerIndex + 1}] [${progress}/${companyUrls.length}] (${percent}%) - ${url}`);

        try {
          const employees = await this.scrapeEmployeesFromCompany(page, url);

          if (employees.length > 0) {
            this.saveEmployees(employees);
            checkpoint.completedCompanies.push(url);
            checkpoint.totalEmployees += employees.length;
            checkpoint.timestamp = new Date().toISOString();
            this.saveCheckpoint(checkpoint);

            console.log(`   ✅ Found ${employees.length} employees`);
          } else {
            checkpoint.completedCompanies.push(url);
            this.saveCheckpoint(checkpoint);
            console.log(`   ⚠️  No employees found`);
          }
        } catch (error: any) {
          console.error(`   ❌ Error: ${error.message}`);
        }

        // Shorter delay with proxies (proxies hide our identity)
        const delay = this.proxies.length > 0 ? 5000 : 15000;
        await this.delay(delay);
      }

      await page.close();
    });

    await Promise.all(workerTasks);

    console.log(`\n✅ Scraping complete!`);
    console.log(`   Total employees: ${checkpoint.totalEmployees}\n`);
  }

  private async scrapeEmployeesFromCompany(page: Page, companyUrl: string): Promise<EmployeeProfileWithContact[]> {
    const companyName = companyUrl.split('/company/')[1]?.replace(/\/$/, '').split('/')[0] || '';

    // Search for people at this company
    const searchUrl = `https://www.linkedin.com/search/results/people/?` +
      `currentCompany=%5B%22${companyName}%22%5D&` +
      `keywords=sales%20OR%20manager%20OR%20director&` +
      `origin=FACETED_SEARCH`;

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.delay(3000);

      // Check auth
      if (page.url().includes('/login') || page.url().includes('/authwall')) {
        return [];
      }

      // Scroll
      for (let i = 0; i < 2; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await this.delay(800);
      }

      // Extract employee data
      const maxEmployees = this.employeesPerCompany;
      const employees = await page.evaluate(({ companyUrl, maxEmployees }) => {
        const results: any[] = [];
        const cards = document.querySelectorAll('.reusable-search__result-container');

        for (let i = 0; i < Math.min(cards.length, maxEmployees); i++) {
          const card = cards[i];

          const profileLink = card.querySelector('a.app-aware-link');
          const profileUrl = profileLink ? (profileLink as HTMLAnchorElement).href.split('?')[0] : '';
          if (!profileUrl) continue;

          const nameElement = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]');
          const fullName = nameElement?.textContent?.trim() || '';

          const headlineElement = card.querySelector('.entity-result__primary-subtitle');
          const headline = headlineElement?.textContent?.trim() || '';

          const locationElement = card.querySelector('.entity-result__secondary-subtitle');
          const location = locationElement?.textContent?.trim() || '';

          const photoElement = card.querySelector('img.presence-entity__image');
          const photoUrl = photoElement ? (photoElement as HTMLImageElement).src : '';

          if (fullName && headline) {
            results.push({
              fullName,
              headline,
              location,
              profileUrl,
              photoUrl,
              companyLinkedInUrl: companyUrl
            });
          }
        }

        return results;
      }, { companyUrl, maxEmployees });

      // Enrich with contact info (visit each profile)
      const enriched: EmployeeProfileWithContact[] = [];

      for (const emp of employees) {
        const profile = await this.enrichWithContact(page, emp);
        enriched.push(profile);
      }

      return enriched;

    } catch (error: any) {
      return [];
    }
  }

  private async enrichWithContact(page: Page, empData: any): Promise<EmployeeProfileWithContact> {
    const [firstName, ...lastNameParts] = empData.fullName.split(' ');
    const lastName = lastNameParts.join(' ');
    const employeeId = empData.profileUrl.split('/in/')[1]?.replace(/\/$/, '') || '';

    // Try to get contact info
    let email = '';
    let phone = '';

    try {
      // Visit profile contact info page
      const contactUrl = empData.profileUrl.replace(/\/$/, '') + '/overlay/contact-info/';
      await page.goto(contactUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await this.delay(2000);

      // Extract email and phone
      const contactInfo = await page.evaluate(() => {
        let email = '';
        let phone = '';

        // Try to find email
        const emailLinks = document.querySelectorAll('a[href^="mailto:"]');
        if (emailLinks.length > 0) {
          email = (emailLinks[0] as HTMLAnchorElement).href.replace('mailto:', '');
        }

        // Try to find phone
        const phoneElements = document.querySelectorAll('.pv-contact-info__contact-type');
        phoneElements.forEach(el => {
          const text = el.textContent || '';
          if (text.toLowerCase().includes('phone')) {
            const phoneText = el.parentElement?.textContent || '';
            const phoneMatch = phoneText.match(/[\+\d\s\(\)\-]{8,}/);
            if (phoneMatch) phone = phoneMatch[0].trim();
          }
        });

        return { email, phone };
      });

      email = contactInfo.email;
      phone = contactInfo.phone;

    } catch (error) {
      // If contact info page fails, try to guess email
      email = this.guessEmail(firstName, lastName, empData.headline);
    }

    // Determine seniority
    const headlineLower = empData.headline.toLowerCase();
    let seniorityLevel = 'Mid-Level';
    if (headlineLower.includes('ceo') || headlineLower.includes('founder') || headlineLower.includes('chief')) {
      seniorityLevel = 'C-Level';
    } else if (headlineLower.includes('vp') || headlineLower.includes('vice president')) {
      seniorityLevel = 'VP';
    } else if (headlineLower.includes('director') || headlineLower.includes('head of')) {
      seniorityLevel = 'Director';
    } else if (headlineLower.includes('manager')) {
      seniorityLevel = 'Manager';
    }

    // Determine department
    let department = 'Other';
    if (headlineLower.includes('sales') || headlineLower.includes('business development')) {
      department = 'Sales';
    } else if (headlineLower.includes('marketing')) {
      department = 'Marketing';
    }

    return {
      employeeId,
      fullName: empData.fullName,
      firstName,
      lastName,
      headline: empData.headline,
      currentTitle: empData.headline.split(' at ')[0] || empData.headline,
      currentCompany: empData.headline.split(' at ')[1] || '',
      companyLinkedInUrl: empData.companyLinkedInUrl,
      location: empData.location,
      profileUrl: empData.profileUrl,
      photoUrl: empData.photoUrl,
      email,
      phone,
      department,
      seniorityLevel,
      scrapedAt: new Date()
    };
  }

  private guessEmail(firstName: string, lastName: string, headline: string): string {
    // Extract company domain from headline
    const companyMatch = headline.match(/at\s+([^\s]+)/i);
    if (!companyMatch) return '';

    const company = companyMatch[1].toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/inc|ltd|llc|corp/g, '');

    const first = firstName.toLowerCase();
    const last = lastName.toLowerCase();

    // Common email patterns
    const patterns = [
      `${first}.${last}@${company}.com`,
      `${first}${last}@${company}.com`,
      `${first[0]}${last}@${company}.com`,
      `${first}_${last}@${company}.com`
    ];

    return patterns[0]; // Return most common pattern
  }

  async close(): Promise<void> {
    for (const browser of this.browsers) {
      await browser.close();
    }
    console.log('🔒 All browsers closed\n');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
