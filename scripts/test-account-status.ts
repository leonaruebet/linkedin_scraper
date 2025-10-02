#!/usr/bin/env ts-node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';

/**
 * Test LinkedIn Account Status
 *
 * This script checks if the checkpoint is due to:
 * - Account flagging (LinkedIn's servers)
 * - Browser fingerprinting
 * - IP blocking
 */

async function testAccountStatus() {
  console.log('\n🧪 LINKEDIN ACCOUNT STATUS TEST\n');
  console.log('═'.repeat(60));
  console.log('This will test your account from a CLEAN browser');
  console.log('to determine if the issue is account-based or browser-based');
  console.log('═'.repeat(60));
  console.log('');

  const email = process.env.LINKEDIN_EMAIL || '';
  const password = process.env.LINKEDIN_PASSWORD || '';

  if (!email || !password) {
    console.log('❌ Missing credentials in .env.local');
    return;
  }

  console.log('📝 Test Steps:');
  console.log('   1. Launch completely fresh browser (no cache)');
  console.log('   2. Login manually');
  console.log('   3. Check if checkpoint appears');
  console.log('   4. Diagnose the issue\n');

  console.log('⏳ Launching fresh browser...\n');

  const browser = await chromium.launch({
    headless: false, // Visible so you can see
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-automation',
      '--disable-web-security'
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });

  // Inject stealth scripts
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    (window as any).chrome = { runtime: {} };
  });

  const page = await context.newPage();

  try {
    console.log('🌐 Navigating to LinkedIn login page...\n');
    await page.goto('https://www.linkedin.com/login');
    await delay(2000);

    console.log('📧 Filling in credentials...');
    await page.fill('#username', email);
    await page.fill('#password', password);

    console.log('🔐 Clicking login...\n');
    await page.click('button[type="submit"]');

    console.log('⏳ Waiting 15 seconds to see what happens...\n');
    await delay(15000);

    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}\n`);

    console.log('═'.repeat(60));
    console.log('TEST RESULTS:');
    console.log('═'.repeat(60));

    if (currentUrl.includes('/feed')) {
      console.log('✅ SUCCESS: Logged in without checkpoint!');
      console.log('');
      console.log('📊 Diagnosis: BROWSER FINGERPRINT ISSUE');
      console.log('');
      console.log('The checkpoint was caused by browser automation detection,');
      console.log('NOT your account. Your account is fine!');
      console.log('');
      console.log('💡 Solution:');
      console.log('   1. The browser reset worked');
      console.log('   2. You can try scraping again NOW');
      console.log('   3. Use slower delays (60-120s between companies)');
      console.log('');

    } else if (currentUrl.includes('/checkpoint') || currentUrl.includes('/challenge')) {
      console.log('⚠️  CHECKPOINT DETECTED AGAIN');
      console.log('');
      console.log('📊 Diagnosis: ACCOUNT IS FLAGGED');
      console.log('');
      console.log('The checkpoint appears even in a fresh browser,');
      console.log('meaning LinkedIn has flagged YOUR ACCOUNT, not just the browser.');
      console.log('');
      console.log('💡 Solutions:');
      console.log('');
      console.log('Option 1: Cool Down Period (Recommended)');
      console.log('   - Stop scraping for 7 days');
      console.log('   - Use LinkedIn normally (browse, like posts)');
      console.log('   - After 7 days, try again with very slow settings');
      console.log('');
      console.log('Option 2: Different Account');
      console.log('   - Create new LinkedIn account');
      console.log('   - Use different email, phone, IP');
      console.log('   - Age it for 2-4 weeks before scraping');
      console.log('');
      console.log('Option 3: Use Data Provider (Fastest)');
      console.log('   - Sign up for Apollo.io ($49/month)');
      console.log('   - Upload your company list');
      console.log('   - Get employees instantly');
      console.log('   - No scraping needed');
      console.log('');
      console.log('Option 4: Proxies + Multiple Accounts');
      console.log('   - Create 3-5 accounts');
      console.log('   - Use residential proxies');
      console.log('   - Rotate accounts daily');
      console.log('');

    } else if (currentUrl.includes('/login')) {
      console.log('❌ LOGIN FAILED');
      console.log('');
      console.log('Credentials might be incorrect or account is locked.');
      console.log('Check your email and password in .env.local');
      console.log('');

    } else {
      console.log('⚠️  UNEXPECTED RESULT');
      console.log('');
      console.log(`You were redirected to: ${currentUrl}`);
      console.log('This is unusual. Manual investigation needed.');
      console.log('');
    }

    console.log('═'.repeat(60));
    console.log('');
    console.log('⏸️  Browser will stay open for 30 seconds so you can inspect...');
    await delay(30000);

  } catch (error: any) {
    console.error('❌ Error during test:', error.message);
  } finally {
    await browser.close();
    console.log('🔒 Browser closed\n');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testAccountStatus();
