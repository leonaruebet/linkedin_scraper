import fs from 'fs';
import path from 'path';

async function clearCache() {
  console.log('🧹 Clearing browser cache and auth state...\n');

  const authPath = path.join(process.cwd(), 'scraped-data', 'linkedin-auth.json');

  if (fs.existsSync(authPath)) {
    fs.unlinkSync(authPath);
    console.log('✅ Deleted: linkedin-auth.json');
  } else {
    console.log('ℹ️  No auth file found');
  }

  console.log('\n✨ Cache cleared! Fresh login required on next run.\n');
}

clearCache();
