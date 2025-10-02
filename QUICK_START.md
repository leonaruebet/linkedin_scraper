# LinkedIn Scraper - Quick Reference

## 📋 Available Commands

### Small Scale (1-100 profiles)
```bash
npm run scrape:pw -- --keywords "sales" --location "Thailand" --limit 20
```

### High Volume (1K-10K+ profiles)
```bash
npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 5000
```

## 🎯 Command Comparison

| Command | Best For | Speed | Features |
|---------|----------|-------|----------|
| `scrape:pw` | 1-100 profiles | ~3 profiles/min | Simple, visible browser |
| `scrape:bulk` | 1,000-10,000+ | ~50 profiles/min | Parallel, auto-resume, headless |

## 🚀 Quick Examples

### Basic Scraping

```bash
# 20 sales profiles
npm run scrape:pw -- --keywords "sales" --location "Thailand" --limit 20

# 50 engineers
npm run scrape:pw -- --keywords "software engineer" --limit 50
```

### High-Volume Scraping

```bash
# 5,000 profiles (conservative)
npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 5000

# 10,000 profiles (fast)
npm run scrape:bulk -- --keywords "software engineer" --limit 10000 --workers 5 --delay-min 2000
```

### Resume After Failure

```bash
# If scraping gets interrupted, just run the same command again
npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 5000
# It will automatically resume from checkpoint!
```

## ⚙️ Configuration Options

### High-Volume Options

| Option | Default | Range | Description |
|--------|---------|-------|-------------|
| `--workers` | 3 | 1-5 | Parallel browsers |
| `--delay-min` | 3000 | 2000+ | Min delay (ms) |
| `--delay-max` | 7000 | 3000+ | Max delay (ms) |
| `--limit` | 1000 | 1-∞ | Total profiles |

## 📊 Performance Guide

### Conservative (Recommended)
```bash
--workers 3 --delay-min 3000 --delay-max 7000
# ~1000 profiles/hour, low detection risk
```

### Balanced
```bash
--workers 4 --delay-min 2500 --delay-max 6000
# ~1500 profiles/hour, moderate risk
```

### Aggressive (Use carefully)
```bash
--workers 5 --delay-min 2000 --delay-max 5000
# ~2000 profiles/hour, higher risk
```

## 📁 Output Files

All data saved to `scraped-data/`:

```
scraped-data/
├── checkpoint.json                    # Resume point (auto-created)
├── sales_thailand_<timestamp>.json   # Search results
├── profiles.json                      # All unique profiles
└── search-results.png                 # Screenshot (debug)
```

## 🔄 Workflow Examples

### Daily Lead Generation (5K profiles)

**Morning Session:**
```bash
npm run scrape:bulk -- --keywords "sales director" --location "Singapore" --limit 2500
```

**Afternoon Session:**
```bash
npm run scrape:bulk -- --keywords "sales manager" --location "Singapore" --limit 2500
```

### Multi-Region Campaign (10K profiles)

```bash
# Day 1: Asia
npm run scrape:bulk -- --keywords "product manager" --location "Thailand" --limit 2000
npm run scrape:bulk -- --keywords "product manager" --location "Singapore" --limit 2000

# Day 2: Americas
npm run scrape:bulk -- --keywords "product manager" --location "United States" --limit 3000
npm run scrape:bulk -- --keywords "product manager" --location "Canada" --limit 2000
```

### Industry Research (20K profiles)

Split by company:
```bash
npm run scrape:bulk -- --keywords "engineer google" --limit 5000
npm run scrape:bulk -- --keywords "engineer meta" --limit 5000
npm run scrape:bulk -- --keywords "engineer amazon" --limit 5000
npm run scrape:bulk -- --keywords "engineer microsoft" --limit 5000
```

## 🛡️ Safety Tips

### DO ✅
- Use 3-7 second delays
- Max 5 parallel workers
- Scrape during business hours
- Take breaks between sessions
- Monitor checkpoint file

### DON'T ❌
- Run continuously 24/7
- Use delays <2 seconds
- Exceed 5 workers
- Scrape same search repeatedly
- Ignore rate limits

## 🔧 Troubleshooting

### Problem: Too Slow
```bash
# Increase workers, reduce delays
--workers 5 --delay-min 2000 --delay-max 5000
```

### Problem: Getting Blocked
```bash
# Reduce workers, increase delays
--workers 2 --delay-min 5000 --delay-max 10000
```

### Problem: Checkpoint Won't Resume
```bash
# Delete checkpoint and start fresh
rm scraped-data/checkpoint.json
```

### Problem: LinkedIn Verification Required
- Complete verification in browser
- Scraper waits 60 seconds automatically
- Will auto-resume after verification

## 📈 Scaling Guide

| Target | Strategy |
|--------|----------|
| 1K | Single session, 3 workers |
| 5K | Single session or 2x 2.5K |
| 10K | 2 sessions of 5K each |
| 50K | 10 sessions of 5K over multiple days |
| 100K | Multiple keywords/locations over weeks |

## 📞 Support

**Documentation:**
- Full guide: [HIGH_VOLUME_GUIDE.md](HIGH_VOLUME_GUIDE.md)
- API docs: [README.md](README.md)

**Check Progress:**
```bash
# View checkpoint status
cat scraped-data/checkpoint.json | jq

# Count scraped profiles
cat scraped-data/profiles.json | jq length
```

---

**Remember:** Use responsibly and respect LinkedIn's Terms of Service! 🚀
