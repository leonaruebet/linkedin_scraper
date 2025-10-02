import { chromium, Browser, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';

/**
 * Stealth Browser Configuration
 *
 * Reduces detection by:
 * - Clearing all browser data
 * - Randomizing user agents
 * - Disabling automation flags
 * - Using realistic browser fingerprints
 * - Randomizing viewport sizes
 */

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1680, height: 1050 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 2560, height: 1440 }
];

export async function createStealthBrowser(headless = true): Promise<Browser> {
  // Clear browser data directory
  const browserDataDir = path.join(process.cwd(), '.browser-data');
  if (fs.existsSync(browserDataDir)) {
    fs.rmSync(browserDataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(browserDataDir, { recursive: true });

  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--start-maximized',
      `--user-data-dir=${browserDataDir}`
    ]
  });

  return browser;
}

export async function createStealthContext(
  browser: Browser,
  storageState?: any
): Promise<BrowserContext> {
  // Random user agent
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

  // Random viewport
  const viewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];

  const context = await browser.newContext({
    userAgent,
    viewport,
    storageState,

    // Locale
    locale: 'en-US',
    timezoneId: 'America/New_York',

    // Permissions
    permissions: [],

    // Geolocation (optional - makes you appear from a consistent location)
    // geolocation: { latitude: 13.7563, longitude: 100.5018 }, // Bangkok

    // Extra HTTP headers to appear more human
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    }
  });

  // Inject scripts to hide automation
  await context.addInitScript(() => {
    // Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false
    });

    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });

    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });

    // Override chrome object
    (window as any).chrome = {
      runtime: {}
    };

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission } as PermissionStatus) :
        originalQuery(parameters)
    );
  });

  return context;
}

export function clearBrowserCache(): void {
  const browserDataDir = path.join(process.cwd(), '.browser-data');
  if (fs.existsSync(browserDataDir)) {
    console.log('🗑️  Clearing browser cache...');
    fs.rmSync(browserDataDir, { recursive: true, force: true });
    console.log('✅ Browser cache cleared');
  }
}

export function clearAllAuthStates(): void {
  const dataDir = path.join(process.cwd(), 'scraped-data');
  const authFiles = [
    'linkedin-auth.json',
    'linkedin-auth-safe.json',
    'linkedin-auth-employees.json'
  ];

  authFiles.forEach(file => {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`🗑️  Deleting ${file}...`);
      fs.unlinkSync(filePath);
    }
  });

  console.log('✅ All auth states cleared');
}

export function resetEverything(): void {
  console.log('\n🔄 RESETTING EVERYTHING...\n');
  clearBrowserCache();
  clearAllAuthStates();
  console.log('\n✅ Reset complete! You can now login fresh.\n');
}
