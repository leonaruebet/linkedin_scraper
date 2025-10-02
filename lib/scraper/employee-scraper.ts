import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

export interface EmployeeProfile {
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

  // Job details
  department?: string;
  seniorityLevel?: string; // Entry, Mid, Senior, Manager, Director, VP, C-Level

  // Contact info (if available)
  email?: string;
  phone?: string;

  // Experience
  yearsAtCompany?: string;
  totalExperience?: string;

  // Metadata
  scrapedAt: Date;
}

interface EmployeeCheckpoint {
  completedCompanies: string[];
  totalEmployees: number;
  scrapedCount: number;
  timestamp: string;
}

/**
 * Employee Scraper - Finds sales & management professionals from companies
 *
 * Features:
 * - Searches for employees at each company
 * - Filters by job titles (Sales, Marketing, Management, C-Level)
 * - Filters by seniority (Manager+)
 * - Extracts employee profiles
 * - Safe rate limiting
 */
export class EmployeeScraper {
  private browser?: Browser;
  private context?: BrowserContext;
  private checkpointPath: string;
  private dataPath: string;

  // Target job titles and keywords
  private readonly TARGET_TITLES = [
    'sales', 'business development', 'account manager', 'account executive',
    'sales manager', 'sales director', 'vp sales', 'chief revenue',
    'marketing', 'marketing manager', 'marketing director', 'cmo',
    'manager', 'director', 'head of', 'vp', 'vice president',
    'ceo', 'cto', 'cfo', 'coo', 'chief', 'founder', 'co-founder',
    'president', 'general manager', 'managing director'
  ];

  private readonly SENIORITY_LEVELS = {
    'C-Level': ['ceo', 'cto', 'cfo', 'coo', 'cmo', 'chief', 'president'],
    'VP': ['vp', 'vice president'],
    'Director': ['director', 'head of'],
    'Manager': ['manager', 'lead'],
    'Senior': ['senior', 'sr.', 'sr '],
  };

  constructor(
    private email: string = process.env.LINKEDIN_EMAIL || '',
    private password: string = process.env.LINKEDIN_PASSWORD || '',
    private maxEmployeesPerCompany: number = 20 // Limit per company
  ) {
    const dataDir = path.join(process.cwd(), 'scraped-data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.checkpointPath = path.join(dataDir, 'employee-checkpoint.json');
    this.dataPath = path.join(dataDir, 'employees.json');
  }

  private loadCheckpoint(): EmployeeCheckpoint {
    if (fs.existsSync(this.checkpointPath)) {
      const data = fs.readFileSync(this.checkpointPath, 'utf-8');
      return JSON.parse(data);
    }
    return {
      completedCompanies: [],
      totalEmployees: 0,
      scrapedCount: 0,
      timestamp: new Date().toISOString()
    };
  }

  private saveCheckpoint(checkpoint: EmployeeCheckpoint): void {
    fs.writeFileSync(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
  }

  private saveEmployees(employees: EmployeeProfile[]): void {
    let allEmployees: EmployeeProfile[] = [];
    if (fs.existsSync(this.dataPath)) {
      const data = fs.readFileSync(this.dataPath, 'utf-8');
      allEmployees = JSON.parse(data);
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
    console.log('👥 EMPLOYEE SCRAPER');
    console.log('═'.repeat(60));
    console.log('🎯 Target Roles:');
    console.log('   - Sales & Business Development');
    console.log('   - Marketing');
    console.log('   - Management (Manager+)');
    console.log('   - C-Level Executives');
    console.log(`📊 Max per company: ${this.maxEmployeesPerCompany} employees`);
    console.log('═'.repeat(60));

    const authStatePath = path.join(process.cwd(), 'scraped-data', 'linkedin-auth-employees.json');

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

        console.log('⏳ Waiting for login... (120 seconds for manual checkpoint solving)');
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
        console.log('💾 Authentication state saved\n');

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

  async scrapeEmployeesFromCompanies(companyUrls: string[]): Promise<EmployeeProfile[]> {
    if (!this.context) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    console.log(`\n📊 Starting employee scraping...`);
    console.log(`   Companies: ${companyUrls.length}`);
    console.log(`   Target: ${this.maxEmployeesPerCompany} employees per company\n`);

    const checkpoint = this.loadCheckpoint();
    const remainingCompanies = companyUrls.filter(url => !checkpoint.completedCompanies.includes(url));

    if (remainingCompanies.length === 0) {
      console.log('✅ All companies already scraped!\n');
      return [];
    }

    console.log(`   Remaining companies: ${remainingCompanies.length}\n`);

    const page = await this.context.newPage();
    let totalEmployeesScraped = 0;

    for (let i = 0; i < remainingCompanies.length; i++) {
      const companyUrl = remainingCompanies[i];
      const progress = checkpoint.completedCompanies.length + i + 1;
      const percent = ((progress / companyUrls.length) * 100).toFixed(1);

      console.log(`\n[${ progress}/${companyUrls.length}] (${percent}%) - ${companyUrl}`);

      try {
        const employees = await this.scrapeEmployeesFromCompany(page, companyUrl);

        if (employees.length > 0) {
          this.saveEmployees(employees);
          totalEmployeesScraped += employees.length;

          checkpoint.completedCompanies.push(companyUrl);
          checkpoint.totalEmployees += employees.length;
          checkpoint.scrapedCount = checkpoint.totalEmployees;
          checkpoint.timestamp = new Date().toISOString();
          this.saveCheckpoint(checkpoint);

          console.log(`   ✅ Found ${employees.length} employees`);
        } else {
          console.log(`   ⚠️  No employees found`);
          checkpoint.completedCompanies.push(companyUrl);
          this.saveCheckpoint(checkpoint);
        }
      } catch (error: any) {
        console.error(`   ❌ Failed: ${error.message}`);
      }

      // Safe delay between companies
      const delay = Math.floor(Math.random() * (30000 - 20000 + 1)) + 20000;
      console.log(`   ⏳ Waiting ${Math.floor(delay/1000)}s...`);
      await this.delay(delay);
    }

    await page.close();

    console.log(`\n✅ Employee scraping complete!`);
    console.log(`   Total employees: ${totalEmployeesScraped}\n`);

    return [];
  }

  private async scrapeEmployeesFromCompany(page: Page, companyUrl: string): Promise<EmployeeProfile[]> {
    // Extract company name from URL
    const companyName = companyUrl.split('/company/')[1]?.replace(/\/$/, '').split('/')[0] || '';

    // Build People search URL for this company with filters
    // This searches for people who work at the company with sales/management titles
    const searchUrl = `https://www.linkedin.com/search/results/people/?` +
      `currentCompany=%5B%22${companyName}%22%5D&` +
      `keywords=sales%20OR%20manager%20OR%20director%20OR%20vp%20OR%20ceo&` +
      `origin=FACETED_SEARCH`;

    console.log(`   🔍 Searching employees...`);

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.delay(3000);

      // Check for auth wall
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint') || currentUrl.includes('/authwall')) {
        console.log(`   ⚠️  Auth wall detected`);
        return [];
      }

      // Scroll to load all results
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await this.delay(1000);
      }

      // Extract employee data from search results
      const maxEmployees = this.maxEmployeesPerCompany;
      const employees = await page.evaluate(({ companyUrl, maxEmployees }) => {
        const results: any[] = [];
        const cards = document.querySelectorAll('.reusable-search__result-container');

        for (let i = 0; i < Math.min(cards.length, maxEmployees); i++) {
          const card = cards[i];

          // Extract profile link
          const profileLink = card.querySelector('a.app-aware-link');
          const profileUrl = profileLink ? (profileLink as HTMLAnchorElement).href.split('?')[0] : '';

          if (!profileUrl) continue;

          // Extract name
          const nameElement = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]');
          const fullName = nameElement?.textContent?.trim() || '';

          // Extract headline (current title)
          const headlineElement = card.querySelector('.entity-result__primary-subtitle');
          const headline = headlineElement?.textContent?.trim() || '';

          // Extract location
          const locationElement = card.querySelector('.entity-result__secondary-subtitle');
          const location = locationElement?.textContent?.trim() || '';

          // Extract photo
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

      // Process and enrich employee data
      const employeeProfiles: EmployeeProfile[] = employees.map((emp: any) => {
        const [firstName, ...lastNameParts] = emp.fullName.split(' ');
        const lastName = lastNameParts.join(' ');

        const employeeId = emp.profileUrl.split('/in/')[1]?.replace(/\/$/, '').split('/')[0] || emp.fullName.replace(/\s+/g, '-').toLowerCase();

        // Determine seniority level from headline
        const headlineLower = emp.headline.toLowerCase();
        let seniorityLevel = 'Mid-Level';

        for (const [level, keywords] of Object.entries(this.SENIORITY_LEVELS)) {
          if (keywords.some(kw => headlineLower.includes(kw))) {
            seniorityLevel = level;
            break;
          }
        }

        // Determine department
        let department = 'Other';
        if (headlineLower.includes('sales') || headlineLower.includes('business development')) {
          department = 'Sales';
        } else if (headlineLower.includes('marketing')) {
          department = 'Marketing';
        } else if (headlineLower.includes('engineer') || headlineLower.includes('developer')) {
          department = 'Engineering';
        } else if (headlineLower.includes('ceo') || headlineLower.includes('founder')) {
          department = 'Executive';
        }

        return {
          employeeId,
          fullName: emp.fullName,
          firstName,
          lastName,
          headline: emp.headline,
          currentTitle: emp.headline.split(' at ')[0] || emp.headline,
          currentCompany: emp.headline.split(' at ')[1] || '',
          companyLinkedInUrl: emp.companyLinkedInUrl,
          location: emp.location,
          profileUrl: emp.profileUrl,
          photoUrl: emp.photoUrl,
          department,
          seniorityLevel,
          scrapedAt: new Date()
        };
      });

      // Filter to only include relevant roles
      const filteredEmployees = employeeProfiles.filter(emp => {
        const titleLower = emp.headline.toLowerCase();
        return this.TARGET_TITLES.some(keyword => titleLower.includes(keyword));
      });

      return filteredEmployees;

    } catch (error: any) {
      console.log(`   ⚠️  Error scraping employees: ${error.message}`);
      return [];
    }
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
