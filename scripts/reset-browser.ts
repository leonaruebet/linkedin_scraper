#!/usr/bin/env ts-node

import { resetEverything } from '../lib/utils/stealth-browser';

console.log('');
console.log('═'.repeat(60));
console.log('🔄 BROWSER & AUTH RESET TOOL');
console.log('═'.repeat(60));
console.log('');
console.log('This will:');
console.log('  1. Clear all browser cache and data');
console.log('  2. Delete all saved LinkedIn authentication');
console.log('  3. Force fresh login on next run');
console.log('');
console.log('Why do this?');
console.log('  - LinkedIn detected your automation');
console.log('  - You want to start completely fresh');
console.log('  - Checkpoints keep appearing');
console.log('');
console.log('═'.repeat(60));
console.log('');

resetEverything();

console.log('');
console.log('💡 Next steps:');
console.log('  1. Wait 1-2 hours before running scraper again');
console.log('  2. Consider using a different IP (VPN)');
console.log('  3. Run with MAX_COMPANIES=1 to test');
console.log('');
console.log('═'.repeat(60));
console.log('');
