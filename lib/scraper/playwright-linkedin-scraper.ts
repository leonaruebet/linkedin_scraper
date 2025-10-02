import { chromium, Browser, Page } from 'playwright';
import { LinkedInProfile } from '../types/linkedin';
import fs from 'fs';
import path from 'path';

export class PlaywrightLinkedInScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isAuthenticated = false;

  constructor(
    private email: string = process.env.LINKEDIN_EMAIL || '',
    private password: string = process.env.LINKEDIN_PASSWORD || ''
  ) {}

  async initialize(): Promise<void> {
    console.log('🚀 Launching browser with Playwright...');

    this.browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });

    this.page = await context.newPage();
    console.log('✅ Browser launched successfully');
  }

  async login(): Promise<boolean> {
    if (!this.page) {
      await this.initialize();
    }

    try {
      console.log('🔐 Navigating to LinkedIn login...');
      await this.page!.goto('https://www.linkedin.com/login', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await this.delay(2000);

      console.log('📝 Entering credentials...');
      await this.page!.fill('#username', this.email);
      await this.delay(1000);
      await this.page!.fill('#password', this.password);
      await this.delay(1000);

      console.log('🔄 Clicking login button...');
      await this.page!.click('button[type="submit"]');

      // Wait for navigation with longer timeout
      await this.page!.waitForTimeout(5000);

      const currentUrl = this.page!.url();
      console.log(`📍 Current URL after login: ${currentUrl}`);

      // Check if verification/checkpoint is required
      if (currentUrl.includes('/checkpoint') || currentUrl.includes('/challenge')) {
        console.log('⚠️  🔐 VERIFICATION REQUIRED!');
        console.log('⚠️  Please complete the verification in the browser window.');
        console.log('⚠️  Waiting 60 seconds for manual completion...');

        // Wait 60 seconds for manual verification
        for (let i = 60; i > 0; i -= 10) {
          await this.delay(10000);
          const url = this.page!.url();
          if (url.includes('/feed') || url.includes('/in/')) {
            console.log('✅ Verification completed!');
            this.isAuthenticated = true;
            return true;
          }
          console.log(`⏳ Waiting... ${i - 10}s remaining`);
        }

        const finalUrl = this.page!.url();
        if (finalUrl.includes('/feed') || finalUrl.includes('/in/')) {
          this.isAuthenticated = true;
          console.log('✅ Login successful!');
          return true;
        }

        console.log('❌ Verification timeout');
        return false;
      }

      // Check if login was successful
      if (currentUrl.includes('/feed') || currentUrl.includes('/in/')) {
        this.isAuthenticated = true;
        console.log('✅ Login successful!');
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('❌ Login failed:', error.message);
      return false;
    }
  }

  async searchProfiles(keywords: string, location?: string, limit: number = 10): Promise<string[]> {
    if (!this.isAuthenticated) {
      const success = await this.login();
      if (!success) throw new Error('Authentication failed');
    }

    try {
      // Simplified search - just use keywords, location filtering happens automatically
      let searchQuery = keywords;
      if (location) {
        searchQuery += ` ${location}`;
      }

      const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(searchQuery)}`;

      console.log(`🔍 Searching: ${searchUrl}`);
      await this.page!.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.delay(5000); // Wait longer for results to load

      // Take screenshot for debugging
      await this.page!.screenshot({ path: 'scraped-data/search-results.png' });
      console.log('📸 Screenshot saved to scraped-data/search-results.png');

      // Scroll to load more results
      for (let i = 0; i < 5; i++) {
        await this.page!.evaluate(() => window.scrollBy(0, window.innerHeight));
        await this.delay(2000);
      }

      const profileUrls = await this.page!.evaluate((maxResults) => {
        const urls: string[] = [];

        // Try multiple selectors for profile links
        const selectors = [
          'a.app-aware-link[href*="/in/"]',
          'a[href*="/in/"]',
          '.entity-result__title-text a',
          '.scaffold-layout__list-container a[href*="/in/"]'
        ];

        for (const selector of selectors) {
          const links = document.querySelectorAll(selector);
          links.forEach((link) => {
            const href = (link as HTMLAnchorElement).href;
            if (href && href.includes('/in/') && !href.includes('/search') && !href.includes('/company')) {
              const cleanUrl = href.split('?')[0].replace(/\/$/, '');
              const match = cleanUrl.match(/https:\/\/[^\/]+\/in\/([^\/]+)/);
              if (match && !urls.includes(cleanUrl) && urls.length < maxResults) {
                urls.push(cleanUrl + '/');
              }
            }
          });
          if (urls.length >= maxResults) break;
        }

        return urls;
      }, limit);

      console.log(`✅ Found ${profileUrls.length} profile URLs`);
      return profileUrls.slice(0, limit);

    } catch (error: any) {
      console.error('❌ Search failed:', error.message);
      return [];
    }
  }

  async scrapeProfile(profileUrl: string): Promise<LinkedInProfile | null> {
    try {
      console.log(`📄 Scraping: ${profileUrl}`);
      await this.page!.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.delay(3000);

      // Scroll to load all sections
      for (let i = 0; i < 3; i++) {
        await this.page!.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
        await this.delay(1000);
      }

      const profile = await this.page!.evaluate((url) => {
        const getText = (selector: string): string => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || '';
        };

        // Extract basic info
        const fullName = getText('h1.text-heading-xlarge') || getText('h1');
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const headline = getText('.text-body-medium.break-words') ||
                        getText('.top-card-layout__headline') ||
                        getText('[class*="headline"]');

        const location = getText('.text-body-small.inline.t-black--light.break-words') ||
                        getText('[class*="location"]');

        const photoElement = document.querySelector('img.pv-top-card-profile-picture__image, img[alt*="Photo"]') as HTMLImageElement;
        const photoUrl = photoElement?.src || '';

        const publicIdentifier = url.split('/in/')[1]?.replace('/', '') || '';

        // Extract experience
        const experiences: any[] = [];
        const expSections = document.querySelectorAll('[data-view-name="profile-component-entity"]');
        expSections.forEach((exp, index) => {
          if (index < 5) { // Limit to top 5 experiences
            const title = exp.querySelector('[class*="profile-section-card"]')?.textContent?.trim();
            const details = exp.querySelectorAll('span[aria-hidden="true"]');

            if (title && details.length > 0) {
              experiences.push({
                title: title.split('\n')[0] || '',
                company: details[0]?.textContent?.trim() || '',
                current: title.toLowerCase().includes('present')
              });
            }
          }
        });

        // Extract skills
        const skills: string[] = [];
        const skillElements = document.querySelectorAll('[data-field="skill_card_skill_topic"] span[aria-hidden="true"]');
        skillElements.forEach((skill, index) => {
          if (index < 10) {
            const skillText = skill.textContent?.trim();
            if (skillText && !skillText.includes('Show') && skillText.length < 50) {
              skills.push(skillText);
            }
          }
        });

        return {
          firstName,
          lastName,
          headline,
          location,
          photoUrl,
          publicIdentifier,
          experiences,
          skills
        };
      }, profileUrl);

      const linkedInProfile: LinkedInProfile = {
        linkedinId: profile.publicIdentifier,
        publicIdentifier: profile.publicIdentifier,
        firstName: profile.firstName,
        lastName: profile.lastName,
        headline: profile.headline,
        location: profile.location,
        photoUrl: profile.photoUrl,
        experience: profile.experiences,
        skills: profile.skills,
        profileUrl,
        scrapedAt: new Date(),
        lastUpdated: new Date(),
      };

      return linkedInProfile;

    } catch (error: any) {
      console.error(`❌ Failed to scrape ${profileUrl}:`, error.message);
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 Browser closed');
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
