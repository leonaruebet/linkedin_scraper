#!/usr/bin/env ts-node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';

async function testThaiLabels() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login to LinkedIn
  console.log('🔐 Logging in to LinkedIn...');
  await page.goto('https://www.linkedin.com/login');
  await page.fill('#username', process.env.LINKEDIN_EMAIL!);
  await page.fill('#password', process.env.LINKEDIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  // Go to a Thai company page
  console.log('📄 Loading company page...');
  await page.goto('https://www.linkedin.com/company/evlomo/about/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Check all dt elements
  console.log('\n📋 All DT elements:');
  const allDts = await page.evaluate(() => {
    // @ts-ignore
    const dts = document.querySelectorAll('dt');
    const result: string[] = [];
    dts.forEach((dt: any) => {
      result.push(dt.innerHTML);
    });
    return result;
  });

  allDts.forEach((dt, i) => console.log(`   ${i+1}. ${dt.substring(0, 100)}`));

  // Extract website and phone specifically
  console.log('\n🔍 Looking for website and phone:');
  const data = await page.evaluate(() => {
    let website = '', phone = '';

    // @ts-ignore
    const allDts = document.querySelectorAll('dt h3');
    allDts.forEach((dtH3: any) => {
      const label = dtH3.textContent?.trim().toLowerCase() || '';
      let current = dtH3.parentElement?.nextElementSibling;

      while (current && current.tagName === 'DD') {
        const ddText = current.textContent?.trim() || '';

        if (label.includes('website') || label.includes('เว็บไซต์')) {
          const link = current.querySelector('a');
          if (link) website = link.href;
          console.log(`Found website with label: "${dtH3.textContent?.trim()}"`);
          break;
        } else if (label.includes('phone') || label.includes('โทรศัพท์')) {
          phone = ddText.split('\n')[0].trim();
          console.log(`Found phone with label: "${dtH3.textContent?.trim()}"`);
          break;
        }

        current = current.nextElementSibling;
      }
    });

    return { website, phone };
  });

  console.log(`   Website: ${data.website}`);
  console.log(`   Phone: ${data.phone}`);

  await browser.close();
}

testThaiLabels().catch(console.error);
