import { chromium, Browser, BrowserContext } from 'playwright';
import { CompanyProfile, CompanySearchFilters } from './company-scraper';
import fs from 'fs';
import path from 'path';

export class HighVolumeCompanyScraper {
  private browsers: Browser[] = [];
  private contexts: BrowserContext[] = [];
  private checkpointPath: string;

  constructor(
    private email: string = process.env.LINKEDIN_EMAIL || '',
    private password: string = process.env.LINKEDIN_PASSWORD || '',
    private maxWorkers: number = 3
  ) {
    this.checkpointPath = path.join(process.cwd(), 'scraped-data', 'company-checkpoint.json');
  }

  async initialize(): Promise<void> {
    console.log(`🚀 Launching ${this.maxWorkers} browser workers...`);

    for (let i = 0; i < this.maxWorkers; i++) {
      const browser = await chromium.launch({
        headless: true,
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
        if (url.includes('/feed')) {
          console.log(`✅ Worker ${index + 1} logged in`);
          await page.close();
          return true;
        }

        await page.close();
        return false;
      } catch (error: any) {
        console.error(`❌ Worker ${index + 1} login failed`);
        await page.close();
        return false;
      }
    });

    await Promise.all(loginPromises);
  }

  async scrapeCompaniesInParallel(
    filters: CompanySearchFilters,
    limit: number
  ): Promise<CompanyProfile[]> {
    await this.initialize();
    await this.loginAllWorkers();

    // Collect company URLs first
    const companyUrls = await this.collectCompanyUrls(filters, limit);

    if (companyUrls.length === 0) {
      console.log('⚠️  No companies found');
      await this.closeAll();
      return [];
    }

    console.log(`\n🔄 Scraping ${companyUrls.length} companies in parallel...`);

    const companies: CompanyProfile[] = [];
    const urlQueue = [...companyUrls];

    const workerTasks = this.contexts.map(async (context, workerIndex) => {
      const page = await context.newPage();

      while (urlQueue.length > 0) {
        const url = urlQueue.shift();
        if (!url) break;

        const remaining = urlQueue.length;
        const progress = companyUrls.length - remaining;
        const percent = ((progress / companyUrls.length) * 100).toFixed(1);

        console.log(`[Worker ${workerIndex + 1}] [${progress}/${companyUrls.length}] (${percent}%)`);

        try {
          const company = await this.scrapeCompany(page, url);
          if (company) {
            companies.push(company);
            this.saveCompany(company);
          }
        } catch (error: any) {
          console.error(`   ❌ Failed: ${error.message}`);
        }

        await this.delay(3000, 7000);
      }

      await page.close();
    });

    await Promise.all(workerTasks);
    await this.closeAll();

    return companies;
  }

  private async collectCompanyUrls(
    filters: CompanySearchFilters,
    limit: number
  ): Promise<string[]> {
    console.log('\n🔍 Collecting company URLs...');

    const context = this.contexts[0];
    const page = await context.newPage();
    const companyUrls: string[] = [];
    let pageNum = 1;
    const maxPages = Math.ceil(limit / 10);

    try {
      while (companyUrls.length < limit && pageNum <= maxPages) {
        let searchUrl = 'https://www.linkedin.com/search/results/companies/?';

        // Build search query with keywords and location
        let searchQuery = filters.keywords || '';
        if (filters.location) {
          searchQuery += (searchQuery ? ' ' : '') + filters.location;
        }

        if (searchQuery) {
          searchUrl += `keywords=${encodeURIComponent(searchQuery)}&`;
        }

        if (filters.companySize && filters.companySize.length > 0) {
          searchUrl += `companySize=${filters.companySize.join(',')}&`;
        }

        if (filters.industry && filters.industry.length > 0) {
          searchUrl += `industry=${filters.industry.join(',')}&`;
        }

        searchUrl += `page=${pageNum}`;

        console.log(`📄 Page ${pageNum}/${maxPages} - Found ${companyUrls.length} so far...`);

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await this.delay(3000);

        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          await this.delay(1000);
        }

        const pageUrls = await page.evaluate(() => {
          const urls: string[] = [];
          const links = document.querySelectorAll('a[href*="/company/"]');

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

        pageUrls.forEach(url => {
          if (!companyUrls.includes(url) && companyUrls.length < limit) {
            companyUrls.push(url);
          }
        });

        if (pageUrls.length === 0) break;

        pageNum++;
        await this.delay(3000, 5000);
      }

      await page.close();
      console.log(`✅ Collected ${companyUrls.length} company URLs`);
      return companyUrls.slice(0, limit);

    } catch (error: any) {
      await page.close();
      console.error('❌ URL collection failed:', error.message);
      return companyUrls;
    }
  }

  private async scrapeCompany(page: any, companyUrl: string): Promise<CompanyProfile | null> {
    try {
      await page.goto(companyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.delay(2000);

      // Navigate to About page
      const aboutUrl = companyUrl.replace(/\/$/, '') + '/about/';
      await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.delay(2000);

      const companyData = await page.evaluate((url: string) => {
        const getText = (selector: string): string => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || '';
        };

        // Basic info - try multiple selectors
        const name = getText('h1.org-top-card-summary__title') ||
                     getText('h1') || '';

        const tagline = getText('.org-top-card-summary__tagline') ||
                       getText('[class*="tagline"]') || '';

        const description = getText('.org-about-us-organization-description__text') ||
                          getText('.lt-line-clamp__raw-line') ||
                          getText('[class*="description"]') || '';

        // Company details - find dl/dt/dd structure
        let industry = '', companySize = '', headquarters = '', founded = '';
        let companyType = '', specialties: string[] = [], website = '', phone = '';

        // Find all dt/dd pairs in the page
        const allDts = document.querySelectorAll('dt h3');

        allDts.forEach((dtH3) => {
          const label = dtH3.textContent?.trim().toLowerCase() || '';
          // Find the next dd sibling
          let current = dtH3.parentElement?.nextElementSibling;

          while (current && current.tagName === 'DD') {
            const ddText = current.textContent?.trim() || '';

            if (label.includes('website')) {
              const link = current.querySelector('a');
              if (link) {
                website = link.href;
              }
              break;
            } else if (label.includes('phone')) {
              // Extract just the phone number, remove extra text
              const phoneMatch = ddText.match(/[\+\d\s\(\)\-]+/);
              phone = phoneMatch ? phoneMatch[0].trim() : ddText.split('\n')[0].trim();
              break;
            } else if (label.includes('industry') || label.includes('industries')) {
              industry = ddText;
              break;
            } else if (label.includes('company size')) {
              // Extract just the number range (e.g., "51-200", "10,001+")
              const sizeMatch = ddText.match(/([\d,]+[-–][\d,]+|[\d,]+\+)/);
              if (sizeMatch) {
                companySize = sizeMatch[1];
              }
              break;
            } else if (label.includes('headquarters')) {
              headquarters = ddText.split('\n')[0].trim();
              break;
            } else if (label.includes('type')) {
              companyType = ddText;
              break;
            } else if (label.includes('founded')) {
              // Extract just the year
              const yearMatch = ddText.match(/\d{4}/);
              if (yearMatch) {
                founded = yearMatch[0];
              }
              break;
            } else if (label.includes('specialties')) {
              specialties = ddText.split(',').map(s => s.trim()).filter(s => s.length > 0);
              break;
            }

            current = current.nextElementSibling;
          }
        });

        const followerText = getText('.org-top-card-summary-info-list__info-item') ||
                            getText('[class*="follower"]') || '';
        const followerMatch = followerText.match(/([\d,]+)\s+followers?/i);
        const followerCount = followerMatch ? parseInt(followerMatch[1].replace(/,/g, '')) : 0;

        const logoElement = document.querySelector('img[alt*="logo"]') as HTMLImageElement ||
                           document.querySelector('.org-top-card-primary-content__logo img') as HTMLImageElement;
        const logoUrl = logoElement?.src || '';

        const universalName = url.split('/company/')[1]?.replace(/\/$/, '').split('/')[0] || '';

        return {
          name, universalName, tagline, description, website, phone,
          industry, companySize, companyType, founded, headquarters,
          followerCount, specialties, logoUrl
        };
      }, companyUrl);

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
        followerCount: companyData.followerCount,
        specialties: companyData.specialties,
        logoUrl: companyData.logoUrl,
        coverImageUrl: '',
        scrapedAt: new Date()
      };

    } catch (error) {
      return null;
    }
  }

  private parseEmployeeCount(companySize: string): number | undefined {
    if (!companySize) return undefined;

    const match = companySize.match(/(\d+)[\s-]*(\d+)?/);
    if (match) {
      const min = parseInt(match[1]);
      const max = match[2] ? parseInt(match[2]) : min;
      return Math.floor((min + max) / 2);
    }

    if (companySize.includes('10,001+')) return 15000;
    if (companySize.includes('5001')) return 7500;
    if (companySize.includes('1001')) return 2500;

    return undefined;
  }

  private saveCompany(company: CompanyProfile): void {
    const dataDir = path.join(process.cwd(), 'scraped-data');
    const companiesFile = path.join(dataDir, 'companies.json');

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    let companies: CompanyProfile[] = [];
    if (fs.existsSync(companiesFile)) {
      const data = fs.readFileSync(companiesFile, 'utf-8');
      companies = JSON.parse(data);
    }

    const index = companies.findIndex(c => c.companyId === company.companyId);
    if (index >= 0) {
      companies[index] = company;
    } else {
      companies.push(company);
    }

    fs.writeFileSync(companiesFile, JSON.stringify(companies, null, 2));
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
