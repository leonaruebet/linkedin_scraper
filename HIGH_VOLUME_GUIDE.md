# High-Volume LinkedIn Scraping Guide (5K-10K+ Profiles)

Complete guide for scraping thousands of LinkedIn profiles efficiently and safely.

## 🚀 Quick Start

### Scrape 5,000 Profiles

```bash
npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 5000
```

### Scrape 10,000 Profiles with Custom Settings

```bash
npm run scrape:bulk -- \
  --keywords "software engineer" \
  --location "Singapore" \
  --limit 10000 \
  --workers 5 \
  --delay-min 2000 \
  --delay-max 6000
```

## 📊 Performance Optimization

### Key Features

✅ **Parallel Processing** - Run 3-5 browsers simultaneously
✅ **Auto-Resume** - Checkpoint system saves progress every 50 profiles
✅ **Smart Rate Limiting** - Random delays (3-7s) to avoid detection
✅ **Batch Processing** - Handle 100 profiles per batch
✅ **Error Recovery** - Auto-retry failed profiles (3 attempts)
✅ **Headless Mode** - Runs in background for better performance

### Speed Estimates

| Profiles | Workers | Delay | Est. Time |
|----------|---------|-------|-----------|
| 1,000    | 3       | 3-7s  | ~20 min   |
| 5,000    | 3       | 3-7s  | ~100 min  |
| 10,000   | 5       | 2-6s  | ~120 min  |

## 🎯 Configuration Options

### Basic Options

```bash
--keywords <text>      # Search keywords (REQUIRED)
--location <text>      # Location filter (optional)
--limit <number>       # Number of profiles (default: 1000)
```

### Advanced Options

```bash
--workers <number>     # Parallel browsers (default: 3, max: 5)
--delay-min <ms>       # Min delay between requests (default: 3000)
--delay-max <ms>       # Max delay between requests (default: 7000)
```

## 📂 Resume / Checkpoint System

The scraper automatically saves progress every 50 profiles to `scraped-data/checkpoint.json`.

### How It Works

1. **Automatic Checkpoints**: Progress saved every 50 profiles
2. **Resume on Failure**: If interrupted, just re-run the same command
3. **Smart Detection**: Automatically detects and resumes from checkpoint
4. **Clean Completion**: Checkpoint deleted when scraping finishes

### Example: Resume After Interruption

```bash
# Start scraping 5000 profiles
npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 5000

# Gets interrupted at profile 2,347...

# Just run the same command again - it will resume from 2,347!
npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 5000
```

Output will show:
```
📂 Checkpoint loaded - resuming from previous session
   Already completed: 2347
   Failed: 23
   Remaining: 2630
```

## 🔄 Parallel Worker Architecture

### How It Works

```
Master Process
    ├── Worker 1 (Browser 1) ──┐
    ├── Worker 2 (Browser 2) ──┼── Parallel Scraping
    └── Worker 3 (Browser 3) ──┘
           ↓
    Shared URL Queue
           ↓
    Local JSON Storage
```

### Worker Configuration

**Conservative (Recommended)**
- 3 workers, 3-7s delays
- ~1000 profiles/hour
- Lower detection risk

**Aggressive (Advanced)**
- 5 workers, 2-5s delays
- ~2000 profiles/hour
- Higher detection risk

**Safe Mode**
- 2 workers, 5-10s delays
- ~500 profiles/hour
- Minimal detection risk

## 📁 Output Structure

### Files Created

```
scraped-data/
├── checkpoint.json                           # Resume checkpoint
├── sales_thailand_1759334200000.json        # Search results
├── profiles.json                             # All unique profiles
└── companies.json                            # All unique companies
```

### Data Format

Each profile includes:
```json
{
  "linkedinId": "john-doe-123",
  "publicIdentifier": "john-doe-123",
  "firstName": "John",
  "lastName": "Doe",
  "headline": "Sales Manager at ABC Corp",
  "location": "Bangkok, Thailand",
  "skills": ["Sales", "Marketing", "CRM"],
  "profileUrl": "https://www.linkedin.com/in/john-doe-123/",
  "scrapedAt": "2025-10-01T...",
  "lastUpdated": "2025-10-01T..."
}
```

## 🛡️ Anti-Detection Best Practices

### DO's ✅

1. **Use Random Delays** - Vary delays between 3-7 seconds
2. **Limit Workers** - Max 3-5 parallel browsers
3. **Run During Business Hours** - Scrape 9AM-6PM local time
4. **Space Out Sessions** - Don't run 24/7, take breaks
5. **Use Real Account** - Don't use fresh/fake accounts
6. **Checkpoint Frequently** - Save progress every 50 profiles

### DON'Ts ❌

1. ❌ Don't run too many workers (>5)
2. ❌ Don't use delays <2 seconds
3. ❌ Don't scrape same search repeatedly
4. ❌ Don't run continuously for >4 hours
5. ❌ Don't use datacenter IPs/VPNs
6. ❌ Don't scrape during off-hours (midnight-6AM)

## 📈 Scaling Strategies

### Scrape 5,000 Profiles

```bash
# Conservative approach - ~2 hours
npm run scrape:bulk -- \
  --keywords "sales manager" \
  --location "Thailand" \
  --limit 5000 \
  --workers 3 \
  --delay-min 3000 \
  --delay-max 7000
```

### Scrape 10,000 Profiles

```bash
# Split into 2 sessions of 5,000
# Session 1 (Morning)
npm run scrape:bulk -- --keywords "software engineer react" --limit 5000

# Break for 2-3 hours

# Session 2 (Afternoon)
npm run scrape:bulk -- --keywords "software engineer python" --limit 5000
```

### Scrape 50,000+ Profiles

**Strategy**: Break into multiple searches

```bash
# Day 1: Sales roles
npm run scrape:bulk -- --keywords "sales manager" --location "Thailand" --limit 5000
npm run scrape:bulk -- --keywords "sales director" --location "Thailand" --limit 5000

# Day 2: Engineering roles
npm run scrape:bulk -- --keywords "software engineer" --location "Singapore" --limit 5000
npm run scrape:bulk -- --keywords "data scientist" --location "Singapore" --limit 5000

# Day 3: Product roles
npm run scrape:bulk -- --keywords "product manager" --location "Vietnam" --limit 5000
```

## 🔧 Troubleshooting

### LinkedIn Asks for Verification

**Solution**: The scraper will pause for 60s. Complete verification in browser, it will auto-resume.

### Scraping Slows Down

**Solution**: Increase delays or reduce workers
```bash
--workers 2 --delay-min 5000 --delay-max 10000
```

### Rate Limited / Blocked

**Solution**:
1. Stop scraping for 24 hours
2. Use different LinkedIn account
3. Reduce workers to 2
4. Increase delays to 5-10 seconds

### Checkpoint Won't Resume

**Solution**: Delete checkpoint manually
```bash
rm scraped-data/checkpoint.json
```

## 📊 Monitoring Progress

### Real-time Output

```
[Worker 1] [1247/5000] (24.9%) john-doe-123
[Worker 2] [1248/5000] (25.0%) jane-smith-456
[Worker 3] [1249/5000] (25.0%) bob-jones-789
💾 Checkpoint saved (1250 completed)
```

### Check Checkpoint Status

```bash
cat scraped-data/checkpoint.json | jq
```

### View Results

```bash
# Count profiles scraped
cat scraped-data/profiles.json | jq length

# View recent profiles
cat scraped-data/profiles.json | jq '.[-10:]'
```

## ⚠️ Legal & Ethical Considerations

**Important Reminders:**

1. **Terms of Service**: LinkedIn prohibits automated scraping
2. **Use at Your Own Risk**: This tool is for educational purposes
3. **Respect Privacy**: Don't misuse scraped data
4. **Rate Limiting**: Don't overload LinkedIn's servers
5. **Commercial Use**: Consider LinkedIn's official API for business use

## 🎯 Advanced Use Cases

### Multi-Region Scraping

```bash
# Asia-Pacific
npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 2000
npm run scrape:bulk -- --keywords "sales" --location "Singapore" --limit 2000
npm run scrape:bulk -- --keywords "sales" --location "Vietnam" --limit 2000

# Europe
npm run scrape:bulk -- --keywords "sales" --location "United Kingdom" --limit 2000
npm run scrape:bulk -- --keywords "sales" --location "Germany" --limit 2000
```

### Industry-Specific Scraping

```bash
# Tech companies
npm run scrape:bulk -- --keywords "software engineer google" --limit 1000
npm run scrape:bulk -- --keywords "software engineer meta" --limit 1000
npm run scrape:bulk -- --keywords "software engineer amazon" --limit 1000

# Startups
npm run scrape:bulk -- --keywords "startup founder" --limit 2000
npm run scrape:bulk -- --keywords "startup CTO" --limit 2000
```

### Skill-Based Scraping

```bash
npm run scrape:bulk -- --keywords "python machine learning" --limit 5000
npm run scrape:bulk -- --keywords "react typescript" --limit 5000
npm run scrape:bulk -- --keywords "kubernetes devops" --limit 5000
```

## 📞 Support

If you encounter issues:

1. Check logs in console output
2. Review `checkpoint.json` for progress
3. Try reducing workers/increasing delays
4. Clear checkpoint and restart

**Remember**: This is a powerful tool. Use responsibly! 🚀
