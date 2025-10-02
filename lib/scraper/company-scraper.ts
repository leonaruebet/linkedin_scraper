import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

export interface CompanyProfile {
  // Basic Info
  companyId: string;
  name: string;
  universalName: string;
  tagline?: string;
  description?: string;

  // Contact Info
  website?: string;
  phone?: string;
  email?: string;

  // Company Details
  industry?: string;
  companySize?: string;
  employeeCount?: number;
  companyType?: string;
  founded?: string;

  // Location
  headquarters?: string;
  locations?: string[];

  // Social
  linkedinUrl: string;
  followerCount?: number;

  // Additional
  specialties?: string[];
  logoUrl?: string;
  coverImageUrl?: string;

  // Metadata
  scrapedAt: Date;
}

export interface CompanySearchFilters {
  keywords?: string;
  industry?: string[];
  companySize?: string[];
  location?: string;
  employeeRange?: {
    min?: number;
    max?: number;
  };
}

export class CompanyScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(
    private email: string = process.env.LINKEDIN_EMAIL || '',
    private password: string = process.env.LINKEDIN_PASSWORD || ''
  ) {}

  async initialize(): Promise<void> {
    console.log('🚀 Launching browser...');

    this.browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });

    this.page = await this.context.newPage();
    console.log('✅ Browser ready');
  }

  async login(): Promise<boolean> {
    if (!this.page) await this.initialize();

    try {
      console.log('🔐 Logging in to LinkedIn...');
      await this.page!.goto('https://www.linkedin.com/login', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await this.delay(2000);

      await this.page!.fill('#username', this.email);
      await this.page!.fill('#password', this.password);
      await this.page!.click('button[type="submit"]');

      await this.page!.waitForTimeout(5000);

      const url = this.page!.url();

      if (url.includes('/checkpoint') || url.includes('/challenge')) {
        console.log('⚠️  Verification required - please complete in browser');
        await this.delay(60000);
        const newUrl = this.page!.url();
        if (newUrl.includes('/feed')) {
          console.log('✅ Login successful');
          return true;
        }
        return false;
      }

      if (url.includes('/feed')) {
        console.log('✅ Login successful');
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('❌ Login failed:', error.message);
      return false;
    }
  }

  async searchCompanies(filters: CompanySearchFilters, limit: number = 10): Promise<string[]> {
    console.log('\n🔍 Searching for companies...');

    const companyUrls: string[] = [];
    let pageNum = 1;
    const maxPages = Math.ceil(limit / 10);

    try {
      while (companyUrls.length < limit && pageNum <= maxPages) {
        let searchUrl = 'https://www.linkedin.com/search/results/companies/?';

        // Add keywords
        if (filters.keywords) {
          searchUrl += `keywords=${encodeURIComponent(filters.keywords)}&`;
        }

        searchUrl += `page=${pageNum}`;

        console.log(`📄 Page ${pageNum}/${maxPages} - Found ${companyUrls.length} URLs so far...`);

        await this.page!.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        await this.delay(3000);

        // Apply filters by clicking on UI elements (only on first page)
        if (pageNum === 1) {
          // Apply Location filter
          if (filters.location) {
            try {
              console.log(`   🔧 Applying location filter: ${filters.location}`);

              // Click "Locations" filter button
              await this.page!.click('button#searchFilter_companyHqGeo');
              await this.delay(2000);

              // Find and click the checkbox for the location
              const locationLabel = await this.page!.$(`label:has-text("${filters.location}")`);
              if (locationLabel) {
                await locationLabel.click();
                await this.delay(1500);

                // Click "Show results" button
                await this.page!.click('button:has-text("Show results")');
                await this.delay(3000);
                console.log(`   ✅ Location filter applied`);
              } else {
                console.log(`   ⚠️  Location "${filters.location}" not found in filter list`);
              }
            } catch (error: any) {
              console.log(`   ⚠️  Could not apply location filter: ${error.message}`);
            }
          }

          // Apply Industry filter
          if (filters.industry && filters.industry.length > 0) {
            try {
              console.log(`   🔧 Applying industry filter: ${filters.industry[0]}`);

              await this.page!.click('button#searchFilter_industryCompanyVertical');
              await this.delay(2000);

              const industryLabel = await this.page!.$(`label:has-text("${filters.industry[0]}")`);
              if (industryLabel) {
                await industryLabel.click();
                await this.delay(1500);

                await this.page!.click('button:has-text("Show results")');
                await this.delay(3000);
                console.log(`   ✅ Industry filter applied`);
              } else {
                console.log(`   ⚠️  Industry "${filters.industry[0]}" not found in filter list`);
              }
            } catch (error: any) {
              console.log(`   ⚠️  Could not apply industry filter: ${error.message}`);
            }
          }

          // Apply Company Size filter
          if (filters.companySize && filters.companySize.length > 0) {
            try {
              console.log(`   🔧 Applying company size filter: ${filters.companySize[0]}`);

              await this.page!.click('button#searchFilter_companySize');
              await this.delay(2000);

              const sizeLabel = await this.page!.$(`label:has-text("${filters.companySize[0]}")`);
              if (sizeLabel) {
                await sizeLabel.click();
                await this.delay(1500);

                await this.page!.click('button:has-text("Show results")');
                await this.delay(3000);
                console.log(`   ✅ Company size filter applied`);
              } else {
                console.log(`   ⚠️  Company size "${filters.companySize[0]}" not found in filter list`);
              }
            } catch (error: any) {
              console.log(`   ⚠️  Could not apply company size filter: ${error.message}`);
            }
          }
        }

        // Scroll to load results
        for (let i = 0; i < 3; i++) {
          await this.page!.evaluate(() => window.scrollBy(0, window.innerHeight));
          await this.delay(1000);
        }

        const pageUrls = await this.page!.evaluate(() => {
          const urls: string[] = [];
          const links = document.querySelectorAll('a[href*="/company/"]');

          links.forEach((link) => {
            const href = (link as HTMLAnchorElement).href;
            if (href && href.includes('/company/') && !href.includes('/search/')) {
              const cleanUrl = href.split('?')[0].replace(/\/$/, '');
              const match = cleanUrl.match(/\/company\/([^\/]+)/);
              if (match && !urls.includes(cleanUrl)) {
                urls.push(cleanUrl + '/');
              }
            }
          });

          return urls;
        });

        pageUrls.forEach(url => {
          if (!companyUrls.includes(url) && companyUrls.length < limit) {
            companyUrls.push(url);
          }
        });

        if (pageUrls.length === 0) {
          console.log('⚠️  No more results');
          break;
        }

        pageNum++;
        await this.delay(3000, 5000);
      }

      console.log(`✅ Collected ${companyUrls.length} company URLs`);
      return companyUrls;

    } catch (error: any) {
      console.error('❌ Search failed:', error.message);
      return companyUrls;
    }
  }

  async scrapeCompany(companyUrl: string): Promise<CompanyProfile | null> {
    try {
      // Navigate to About page directly for more details
      const aboutUrl = companyUrl.replace(/\/$/, '') + '/about/';
      await this.page!.goto(aboutUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Wait for content to load
      await this.delay(5000);

      // Scroll to load all sections
      for (let i = 0; i < 8; i++) {
        await this.page!.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
        await this.delay(800);
      }

      // Wait a bit more for dynamic content
      await this.delay(2000);

      const companyData = await this.page!.evaluate((url) => {
        const getText = (selector: string): string => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || '';
        };

        const getAll = (selector: string): string[] => {
          return Array.from(document.querySelectorAll(selector))
            .map(el => el.textContent?.trim() || '')
            .filter(text => text.length > 0);
        };

        // Basic info - try multiple selectors
        const name = getText('h1.org-top-card-summary__title') ||
                     getText('h1') || '';

        const tagline = getText('.org-top-card-summary__tagline') ||
                       getText('[class*="tagline"]') || '';

        // Description - try multiple selectors
        const description = getText('.org-about-us-organization-description__text') ||
                          getText('.lt-line-clamp__raw-line') ||
                          getText('[class*="description"]') ||
                          getText('.break-words') || '';

        // Company details - find dl/dt/dd structure
        let industry = '';
        let companySize = '';
        let headquarters = '';
        let founded = '';
        let companyType = '';
        let specialties: string[] = [];
        let website = '';
        let phone = '';

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

        // Follower count - try multiple patterns
        const followerText = getText('.org-top-card-summary-info-list__info-item') ||
                            getText('[class*="follower"]') || '';
        const followerMatch = followerText.match(/([\d,]+)\s+followers?/i);
        const followerCount = followerMatch ? parseInt(followerMatch[1].replace(/,/g, '')) : 0;

        // Logo - try multiple selectors
        const logoElement = document.querySelector('img[alt*="logo"]') as HTMLImageElement ||
                           document.querySelector('.org-top-card-primary-content__logo img') as HTMLImageElement ||
                           document.querySelector('img.org-top-card-primary-content__logo') as HTMLImageElement;
        const logoUrl = logoElement?.src || '';

        // Cover image
        const coverElement = document.querySelector('.org-top-card-primary-content__hero-image img') as HTMLImageElement ||
                            document.querySelector('[class*="hero"] img') as HTMLImageElement;
        const coverImageUrl = coverElement?.src || '';

        // Extract company ID from URL
        const universalName = url.split('/company/')[1]?.replace(/\/$/, '').split('/')[0] || '';

        // Locations
        const locations = getAll('.org-locations-module__location-name');

        return {
          name,
          universalName,
          tagline,
          description,
          website,
          phone,
          industry,
          companySize,
          companyType,
          founded,
          headquarters,
          locations,
          followerCount,
          specialties,
          logoUrl,
          coverImageUrl
        };
      }, companyUrl);

      // Try to extract email from website if available
      let email = '';
      if (companyData.website) {
        email = await this.extractEmailFromWebsite(companyData.website);
      }

      // Parse employee count from company size
      const employeeCount = this.parseEmployeeCount(companyData.companySize);

      const company: CompanyProfile = {
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
        employeeCount: employeeCount,
        companyType: companyData.companyType,
        founded: companyData.founded,
        headquarters: companyData.headquarters,
        locations: companyData.locations,
        linkedinUrl: companyUrl,
        followerCount: companyData.followerCount,
        specialties: companyData.specialties,
        logoUrl: companyData.logoUrl,
        coverImageUrl: companyData.coverImageUrl,
        scrapedAt: new Date()
      };

      return company;

    } catch (error: any) {
      console.error(`❌ Failed to scrape ${companyUrl}:`, error.message);
      return null;
    }
  }

  private async extractEmailFromWebsite(websiteUrl: string): Promise<string> {
    try {
      const response = await this.page!.goto(websiteUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      if (!response || !response.ok()) return '';

      const emails = await this.page!.evaluate(() => {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const text = document.body.textContent || '';
        const matches = text.match(emailRegex);

        if (matches) {
          // Filter out common non-contact emails
          return matches.filter(email =>
            !email.includes('example.com') &&
            !email.includes('sentry.io') &&
            !email.includes('google') &&
            !email.includes('facebook')
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

    const match = companySize.match(/(\d+)[\s-]*(\d+)?/);
    if (match) {
      const min = parseInt(match[1]);
      const max = match[2] ? parseInt(match[2]) : min;
      return Math.floor((min + max) / 2); // Return average
    }

    // Handle special cases
    if (companySize.includes('10,001+')) return 15000;
    if (companySize.includes('5001')) return 7500;
    if (companySize.includes('1001')) return 2500;

    return undefined;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Browser closed');
    }
  }

  private async delay(minMs: number, maxMs?: number): Promise<void> {
    const ms = maxMs ? Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs : minMs;
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
