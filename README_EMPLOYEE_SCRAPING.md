# 👥 Employee Scraping - Complete Guide

## ✅ What I've Built For You

### 1. **Employee Scraper**
Finds sales & management professionals from your 969 companies.

### 2. **Anti-Detection Tools**
Browser reset and stealth features to avoid LinkedIn checkpoints.

### 3. **Safe Rate Limiting**
Smart delays and daily limits to prevent bans.

---

## 🚀 Quick Start

### Reset & Start Fresh

```bash
# 1. Reset everything (clear cache & auth)
npm run reset:browser

# 2. Wait 1-2 hours (important!)

# 3. Test with 1 company
MAX_COMPANIES=1 npm run scrape:employees

# 4. If successful, continue with more
MAX_COMPANIES=10 npm run scrape:employees
```

---

## 📊 What You'll Get

### Employee Data Includes:

```json
{
  "fullName": "John Doe",
  "currentTitle": "Sales Director",
  "currentCompany": "Tech Company",
  "department": "Sales",
  "seniorityLevel": "Director",
  "location": "Bangkok, Thailand",
  "profileUrl": "https://linkedin.com/in/john-doe/",
  "companyLinkedInUrl": "https://linkedin.com/company/tech-company/"
}
```

### Target Roles:
- ✅ Sales (Manager, Director, VP, etc.)
- ✅ Marketing (Manager, Director, CMO)
- ✅ Management (Manager+)
- ✅ C-Level (CEO, CTO, CFO, etc.)

---

## ⚡ Performance & Limits

### For Your 969 Companies:

| Speed | Companies/Day | Total Time | Risk |
|-------|--------------|------------|------|
| 🐢 **Safe** | 50/day | ~20 days | ✅ Low |
| ⚠️ **Moderate** | 100/day | ~10 days | ⚠️ Medium |
| 🔴 **Risky** | 200+/day | ~5 days | ❌ High |

**Recommendation:** Use Safe mode (50/day) to avoid detection.

### Expected Output:
- **~20 employees per company**
- **Total employees:** ~10,000-15,000
- **Time per company:** ~60-120 seconds

---

## 🛡️ Avoiding Detection (IMPORTANT!)

### Why You Got Checkpoints:

LinkedIn detected automation because:
1. ❌ Delays were too fast (10-30s)
2. ❌ Too many requests in short time
3. ❌ Browser fingerprints matched previous attempts
4. ❌ Didn't take breaks between sessions

### How to Fix:

#### 1. **Reset Everything First**
```bash
npm run reset:browser
```

#### 2. **Wait Before Retrying**
- ⏰ **1-2 hours minimum**
- 🌐 **Use VPN if possible**
- ☕ **Don't rush!**

#### 3. **Use Slower Delays**

Edit `lib/scraper/employee-scraper.ts` (line ~273):

```typescript
// Change from:
await this.delay(20000, 30000); // 20-30s - TOO FAST

// To:
await this.delay(60000, 120000); // 60-120s - SAFER
```

#### 4. **Daily Limits**

```bash
# Day 1: 20 companies (safe test)
MAX_COMPANIES=20 npm run scrape:employees

# Day 2: Next 20 companies
MAX_COMPANIES=40 npm run scrape:employees

# Day 3: Next 20 companies
MAX_COMPANIES=60 npm run scrape:employees

# ... continue daily
```

#### 5. **Take Breaks**

Don't scrape for more than 2 hours straight:
- Scrape for 2 hours (~30 companies)
- Wait 2-3 hours
- Resume for another 2 hours

---

## 📁 Output Files

### `scraped-data/employees.json`
All employee profiles in JSON format.

### `scraped-data/employee-checkpoint.json`
Progress tracking - resume anytime.

### View Data:
```bash
# Count total employees
cat scraped-data/employees.json | jq length

# View first 5
cat scraped-data/employees.json | jq '.[0:5]'

# Filter by department
cat scraped-data/employees.json | jq '.[] | select(.department == "Sales")'

# Count by seniority
cat scraped-data/employees.json | jq 'group_by(.seniorityLevel) | map({level: .[0].seniorityLevel, count: length})'
```

---

## 🎯 Recommended Workflow

### Week 1: Test & Validate

**Monday:**
```bash
npm run reset:browser
# Wait 2 hours
MAX_COMPANIES=5 npm run scrape:employees
```

Check output - if good, continue.

**Tuesday-Friday:**
```bash
# Each day, scrape 20 more companies
MAX_COMPANIES=25 npm run scrape:employees  # Day 2
MAX_COMPANIES=45 npm run scrape:employees  # Day 3
MAX_COMPANIES=65 npm run scrape:employees  # Day 4
MAX_COMPANIES=85 npm run scrape:employees  # Day 5
```

**Weekend:** Rest (no scraping)

### Week 2-4: Full Production

Continue with 20-50 companies/day:
- **Total:** ~20 days to complete 969 companies
- **Output:** ~10,000-15,000 employee profiles

---

## 🚨 Troubleshooting

### Checkpoint Appears Again

```bash
# 1. STOP immediately
# 2. Reset everything
npm run reset:browser

# 3. Wait 24 hours (yes, full day)

# 4. Try with VPN + slower delays
```

### "No employees found"

Normal! Some companies:
- Have no public employees
- Have privacy settings enabled
- Are too small

### Scraper Stuck

It's working! Just waiting between companies (60-120s).

### Want Faster Results

**Option 1:** Use data provider (Apollo.io)
- Cost: ~$50-100/month
- Time: 1-2 days
- No bans

**Option 2:** Increase daily limit to 100
- Higher ban risk
- Finish in ~10 days
- Monitor for checkpoints

---

## 📚 Documentation

Read these for more details:

1. **EMPLOYEE_SCRAPER_GUIDE.md** - Full employee scraper guide
2. **AVOID_DETECTION.md** - Anti-detection techniques
3. **SCRAPING_OPTIONS.md** - Alternative approaches

---

## 💡 Pro Tips

### 1. Start Small
Test with 5 companies before going big.

### 2. Monitor Progress
Check employee count daily:
```bash
cat scraped-data/employees.json | jq length
```

### 3. Backup Data
Copy `scraped-data/` folder regularly:
```bash
cp -r scraped-data/ scraped-data-backup-$(date +%Y%m%d)/
```

### 4. Mix Manual Activity
Before scraping:
- Login manually to LinkedIn
- Browse a few profiles
- Like a post or two
- Then start scraper

This makes your account look more human.

### 5. Use VPN Rotation
If you have VPN:
- Day 1: US IP
- Day 2: UK IP
- Day 3: Singapore IP
- Repeat

---

## 🎯 Current Status

✅ **Phase 1 Complete:** 969 company URLs collected
⏸️ **Phase 2 Pending:** Employee scraping (waiting for you)

### Next Steps:

1. ⏰ **Wait 1-2 hours** after reset
2. 🌐 **(Optional) Connect VPN**
3. 🧪 **Test:** `MAX_COMPANIES=1 npm run scrape:employees`
4. 🚀 **Production:** Start with 20/day

---

## ⚙️ Configuration

### `.env.local`
```bash
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password
MAX_COMPANIES=20  # Optional: set default limit
```

### Customize Target Roles

Edit `lib/scraper/employee-scraper.ts`:

```typescript
private readonly TARGET_TITLES = [
  'sales',
  'business development',
  'marketing',
  // Add your custom titles
];
```

---

## 🆘 Need Help?

1. Read `AVOID_DETECTION.md`
2. Check `EMPLOYEE_SCRAPER_GUIDE.md`
3. Review `SCRAPING_OPTIONS.md` for alternatives

---

**Remember: Slow and steady wins! 🐢**

Better to take 20 days and succeed than rush and get banned.
