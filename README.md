# LinkedIn Scraper - Apollo Clone

Production-ready LinkedIn scraper optimized for high-volume data extraction (5K-10K+ profiles).

## ✨ Features

### Profile Scraping
- ✅ **Profile Data** - Name, headline, location, skills, experience
- ✅ **Search by Keywords** - "sales Thailand", "software engineer Singapore"
- ✅ **Parallel Processing** - 2-5 browsers running simultaneously
- ✅ **Auto-Resume** - Checkpoint every 50 profiles, resume on failure
- ✅ **Smart Rate Limiting** - Random 3-7s delays to avoid detection
- ✅ **High Performance** - ~50 profiles/minute

### Company Scraping
- ✅ **Company Data** - Name, industry, size, headquarters, specialties
- ✅ **Contact Info** - Website, phone, email (extracted from website)
- ✅ **Search Filters** - Keywords, location, industry, company size
- ✅ **Parallel Processing** - 3-5 browsers for bulk scraping
- ✅ **Comprehensive Data** - Founded date, employee count, locations

### General
- ✅ **Local Storage** - Save to JSON files (no database required)

## 🚀 Quick Start

### 1. Install

```bash
npm install
npx playwright install chromium
```

### 2. Configure

Create `.env.local`:
```env
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password
```

### 3. Run

**Profile Scraping - Small Scale (1-100 profiles)**
```bash
npm run scrape -- --keywords "sales" --location "Thailand" --limit 20
```

**Profile Scraping - High Volume (1K-10K+ profiles)**
```bash
npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 5000
```

**Company Scraping - Small Scale (1-100 companies)**
```bash
npm run scrape:companies -- --keywords "technology" --location "Bangkok" --limit 20
```

**Company Scraping - High Volume (100-1000+ companies)**
```bash
npm run scrape:companies:bulk -- --keywords "software" --location "Thailand" --limit 500
```

## 📊 Performance

| Profiles | Workers | Time |
|----------|---------|------|
| 100 | 1 | ~5 min |
| 1,000 | 3 | ~20 min |
| 5,000 | 3 | ~100 min |
| 10,000 | 5 | ~120 min |

## 📖 Commands

### Profile Scraping

**Basic Scraping**
```bash
# 20 sales profiles from Thailand
npm run scrape -- --keywords "sales" --location "Thailand" --limit 20

# 50 engineers
npm run scrape -- --keywords "software engineer" --limit 50
```

**High-Volume Scraping**
```bash
# 5,000 profiles (recommended settings)
npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 5000

# 10,000 profiles (maximum speed)
npm run scrape:bulk -- \
  --keywords "software engineer" \
  --limit 10000 \
  --workers 5 \
  --delay-min 2000 \
  --delay-max 5000
```

### Company Scraping

**Basic Company Scraping**
```bash
# 20 technology companies in Bangkok
npm run scrape:companies -- --keywords "technology" --location "Bangkok" --limit 20

# 50 companies with industry filter
npm run scrape:companies -- --industry "Software Development" --location "Thailand" --limit 50

# Companies by size
npm run scrape:companies -- --keywords "startup" --size "1-50" --limit 30
```

**High-Volume Company Scraping**
```bash
# 500 companies (recommended settings)
npm run scrape:companies:bulk -- --keywords "fintech" --location "Thailand" --limit 500

# 1,000 companies with multiple filters
npm run scrape:companies:bulk -- \
  --keywords "AI" \
  --industry "Software Development" \
  --location "Singapore" \
  --size "51-200" \
  --limit 1000 \
  --workers 5
```

### Configuration Options

**Profile Scraping**
| Option | Default | Description |
|--------|---------|-------------|
| `--keywords` | Required | Search keywords |
| `--location` | Optional | Location filter |
| `--limit` | 1000 | Number of profiles |
| `--workers` | 3 | Parallel browsers (1-5) |
| `--delay-min` | 3000 | Min delay in ms |
| `--delay-max` | 7000 | Max delay in ms |

**Company Scraping**
| Option | Default | Description |
|--------|---------|-------------|
| `--keywords` | Optional* | Search keywords |
| `--industry` | Optional* | Industry filter |
| `--location` | Optional | Location filter |
| `--size` | Optional | Company size (e.g., "1-50", "51-200") |
| `--limit` | 10 | Number of companies |
| `--workers` | 3 | Parallel browsers (1-5, bulk only) |

*At least one of `--keywords` or `--industry` is required

## 💾 Output

All data saved to `scraped-data/`:

```
scraped-data/
├── checkpoint.json                        # Auto-resume point (profiles)
├── company-checkpoint.json                # Auto-resume point (companies)
├── sales_thailand_<timestamp>.json       # Profile search results
├── technology_companies_<timestamp>.json # Company search results
├── profiles.json                          # All unique profiles
└── companies.json                         # All unique companies
```

### Profile Data Format

```json
{
  "linkedinId": "john-doe-123",
  "firstName": "John",
  "lastName": "Doe",
  "headline": "Sales Manager at ABC Corp",
  "location": "Bangkok, Thailand",
  "skills": ["Sales", "Marketing", "CRM"],
  "profileUrl": "https://www.linkedin.com/in/john-doe-123/",
  "scrapedAt": "2025-10-01T..."
}
```

### Company Data Format

```json
{
  "companyId": "abc-corp",
  "name": "ABC Corp",
  "industry": "Software Development",
  "companySize": "51-200",
  "employeeCount": 125,
  "headquarters": "Bangkok, Thailand",
  "website": "https://www.abccorp.com",
  "phone": "+66 2 123 4567",
  "email": "contact@abccorp.com",
  "specialties": ["AI", "Machine Learning", "SaaS"],
  "founded": "2015",
  "linkedinUrl": "https://www.linkedin.com/company/abc-corp/",
  "scrapedAt": "2025-10-01T..."
}
```

## 🔄 Auto-Resume

Scraping automatically saves progress every 50 profiles. If interrupted, just re-run the same command:

```bash
# Start scraping
npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 5000

# If interrupted... just run again!
npm run scrape:bulk -- --keywords "sales" --location "Thailand" --limit 5000
# ✅ Automatically resumes from checkpoint
```

## 🎯 Use Cases

### Lead Generation
```bash
npm run scrape:bulk -- --keywords "sales director" --location "Singapore" --limit 2500
npm run scrape:bulk -- --keywords "sales manager" --location "Singapore" --limit 2500
```

### Recruitment
```bash
npm run scrape:bulk -- --keywords "software engineer python" --limit 5000
npm run scrape:bulk -- --keywords "data scientist" --limit 5000
```

### Market Research
```bash
npm run scrape:bulk -- --keywords "product manager" --location "Thailand" --limit 2000
npm run scrape:bulk -- --keywords "product manager" --location "Singapore" --limit 2000
```

## 🛡️ Best Practices

### DO ✅
- Use 3-7 second delays
- Max 3-5 parallel workers
- Scrape during business hours
- Take breaks between sessions
- Monitor checkpoint file

### DON'T ❌
- Run continuously 24/7
- Use delays <2 seconds
- Exceed 5 workers
- Scrape same search repeatedly
- Ignore rate limits

## 📁 Project Structure

```
.
├── lib/
│   ├── scraper/
│   │   ├── playwright-linkedin-scraper.ts  # Basic scraper
│   │   └── high-volume-scraper.ts          # Parallel scraper
│   ├── services/
│   │   └── local-storage-service.ts        # JSON storage
│   └── types/
│       └── linkedin.ts                     # TypeScript types
├── scripts/
│   ├── scrape-playwright.ts                # Basic CLI
│   └── scrape-high-volume.ts               # Bulk CLI
├── HIGH_VOLUME_GUIDE.md                    # Detailed guide
├── QUICK_START.md                          # Quick reference
└── package.json
```

## 🔧 Troubleshooting

### Too Slow
```bash
# Increase workers, reduce delays
npm run scrape:bulk -- --keywords "sales" --limit 5000 --workers 5 --delay-min 2000
```

### Getting Blocked
```bash
# Reduce workers, increase delays
npm run scrape:bulk -- --keywords "sales" --limit 5000 --workers 2 --delay-min 5000
```

### Reset Checkpoint
```bash
rm scraped-data/checkpoint.json
```

## 📚 Documentation

- **Quick Start**: [QUICK_START.md](QUICK_START.md) - One-page reference
- **High Volume Guide**: [HIGH_VOLUME_GUIDE.md](HIGH_VOLUME_GUIDE.md) - Complete guide for 5K-10K scraping
- **Summary**: [SUMMARY.md](SUMMARY.md) - Project overview

## ⚠️ Legal Notice

This tool is for **educational purposes only**. LinkedIn's Terms of Service prohibit automated scraping. Use at your own risk and consider:

- LinkedIn's official API for commercial use
- Respecting user privacy and data protection laws
- Rate limiting to avoid server overload
- Ethical use of scraped data

## 📈 Scaling Guide

| Target | Strategy |
|--------|----------|
| 1K | Single session, 3 workers |
| 5K | Single session or 2x 2.5K |
| 10K | 2 sessions of 5K each |
| 50K | Multiple keywords/locations over days |
| 100K+ | Distributed across multiple accounts/machines |

## 🎉 Features Tested

✅ Authentication with LinkedIn
✅ Profile search by keywords + location
✅ Parallel scraping with multiple workers
✅ Checkpoint and auto-resume
✅ Rate limiting and anti-detection
✅ Real-time progress tracking
✅ JSON file storage

**Ready for production use!** 🚀

## 📞 Support

Check progress:
```bash
cat scraped-data/checkpoint.json | jq
cat scraped-data/profiles.json | jq length
```

---

Built with ❤️ using Playwright and TypeScript
