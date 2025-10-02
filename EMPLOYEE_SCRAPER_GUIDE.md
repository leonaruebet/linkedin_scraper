# 👥 LinkedIn Employee Scraper Guide

## Overview

This scraper finds **sales and management professionals** from the companies in your `phase1-urls-checkpoint.json`.

## 🎯 What It Does

### Target Roles:
- ✅ **Sales**: Sales Manager, Sales Director, Account Executive, Business Development
- ✅ **Marketing**: Marketing Manager, Marketing Director, CMO
- ✅ **Management**: Manager, Director, Head of, VP
- ✅ **C-Level**: CEO, CTO, CFO, COO, President, Founders

### Features:
- Searches LinkedIn for employees at each company
- Filters by job titles and seniority
- Extracts up to 20 employees per company
- Safe rate limiting (20-30s between companies)
- Checkpoint system (resume anytime)
- Auth validation

## 📊 Data Extracted

For each employee:

```typescript
{
  employeeId: "john-doe-123",
  fullName: "John Doe",
  firstName: "John",
  lastName: "Doe",
  headline: "Sales Director at Tech Company",
  currentTitle: "Sales Director",
  currentCompany: "Tech Company",
  companyLinkedInUrl: "https://linkedin.com/company/tech-company/",
  location: "Bangkok, Thailand",
  profileUrl: "https://linkedin.com/in/john-doe-123/",
  photoUrl: "https://...",

  // Classification
  department: "Sales",           // Sales, Marketing, Executive, Engineering, Other
  seniorityLevel: "Director",    // C-Level, VP, Director, Manager, Senior, Mid-Level

  // Metadata
  scrapedAt: "2025-10-02T..."
}
```

## 🚀 Quick Start

### 1. Basic Usage (All Companies)

Scrape employees from ALL companies in your list:

```bash
npm run scrape:employees
```

### 2. Test with Limited Companies

Test with just 5 companies first:

```bash
MAX_COMPANIES=5 npm run scrape:employees
```

### 3. Check Progress

Your data is saved to:
- **employees.json** - All employee profiles
- **employee-checkpoint.json** - Progress tracking

## 📁 Output Files

### `scraped-data/employees.json`

All employee profiles in JSON format:

```json
[
  {
    "employeeId": "jane-smith",
    "fullName": "Jane Smith",
    "headline": "VP of Sales at Awesome Company",
    "currentTitle": "VP of Sales",
    "department": "Sales",
    "seniorityLevel": "VP",
    "profileUrl": "https://linkedin.com/in/jane-smith/",
    "location": "Bangkok, Thailand"
  }
]
```

### `scraped-data/employee-checkpoint.json`

Progress tracking:

```json
{
  "completedCompanies": [
    "https://linkedin.com/company/tech-company/",
    "https://linkedin.com/company/another-company/"
  ],
  "totalEmployees": 35,
  "scrapedCount": 35,
  "timestamp": "2025-10-02T..."
}
```

## ⚙️ Configuration

### Environment Variables

Add to `.env.local`:

```bash
# LinkedIn credentials (required)
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password

# Optional: Limit number of companies to scrape
MAX_COMPANIES=10

# Optional: Max employees per company (default: 20)
# Note: Lower = faster, Higher = more data
```

### Customize Target Roles

Edit `lib/scraper/employee-scraper.ts`:

```typescript
private readonly TARGET_TITLES = [
  'sales',                    // Add more keywords
  'business development',
  'marketing',
  'ceo',
  'founder',
  // Add your custom titles here
];
```

## 📈 Performance & Limits

### Speed:
- **20-30 seconds** between companies (safe rate)
- **~20 employees** per company maximum
- **~100 employees/hour** safely

### For 969 Companies:
- **Total time**: ~10-20 hours
- **Total employees**: ~10,000-15,000 (at 20/company)
- **Best practice**: Run in batches

### Daily Limits:
- **Recommended**: 50-100 companies/day
- **Maximum safe**: 200 companies/day

## 🛡️ Safety Features

### 1. Authentication Validation
Tests saved login before starting (no blank data)

### 2. Rate Limiting
- 20-30 second delays between companies
- Random delays to appear human
- Auto-pause on auth issues

### 3. Checkpoint System
- Saves progress after each company
- Resume anytime without losing data
- Skips already-scraped companies

### 4. Auth Wall Detection
- Detects when kicked to login page
- Stops scraping automatically
- Preserves collected data

## 🎯 Example Workflows

### Workflow 1: Test First
```bash
# Test with 5 companies
MAX_COMPANIES=5 npm run scrape:employees

# Check output
cat scraped-data/employees.json | jq length

# If good, run full batch
MAX_COMPANIES=50 npm run scrape:employees
```

### Workflow 2: Daily Batches
```bash
# Day 1: First 100 companies
MAX_COMPANIES=100 npm run scrape:employees

# Day 2: Next 100 companies (resumes automatically)
MAX_COMPANIES=200 npm run scrape:employees

# Day 3: Next 100...
MAX_COMPANIES=300 npm run scrape:employees
```

### Workflow 3: Filter by Department

After scraping, filter the data:

```bash
# Get only Sales people
cat scraped-data/employees.json | jq '.[] | select(.department == "Sales")'

# Get only C-Level
cat scraped-data/employees.json | jq '.[] | select(.seniorityLevel == "C-Level")'

# Get Sales Directors and above
cat scraped-data/employees.json | jq '.[] | select(.department == "Sales" and (.seniorityLevel == "Director" or .seniorityLevel == "VP" or .seniorityLevel == "C-Level"))'
```

## 🔧 Troubleshooting

### "No employees found"
**Cause**: Company search returned no results
**Solution**: Normal - some companies have no public employees

### "Auth wall detected"
**Cause**: LinkedIn kicked you to login page
**Solution**:
1. Stop the scraper
2. Re-run (it will login fresh)
3. Solve checkpoint if appears

### "Checkpoint appears during login"
**Cause**: LinkedIn security check
**Solution**:
1. Don't close the browser window
2. Solve the checkpoint manually (click images, etc.)
3. Wait - scraper auto-continues after 120s

### Scraper seems stuck
**Cause**: Waiting between companies
**Solution**: Be patient, it's working (check console for progress)

## 📊 Data Analysis Examples

### Count by Department
```bash
cat scraped-data/employees.json | jq 'group_by(.department) | map({department: .[0].department, count: length})'
```

### Count by Seniority
```bash
cat scraped-data/employees.json | jq 'group_by(.seniorityLevel) | map({level: .[0].seniorityLevel, count: length})'
```

### Top Companies by Employee Count
```bash
cat scraped-data/employees.json | jq 'group_by(.currentCompany) | map({company: .[0].currentCompany, employees: length}) | sort_by(.employees) | reverse | .[0:10]'
```

### Export to CSV
```bash
cat scraped-data/employees.json | jq -r '.[] | [.fullName, .currentTitle, .currentCompany, .department, .seniorityLevel, .location, .profileUrl] | @csv' > employees.csv
```

## ⚠️ Important Notes

### 1. LinkedIn Limits
- Don't scrape more than 200 companies/day
- Take breaks every 2-3 hours
- Use safe delays (don't modify to be faster)

### 2. Data Quality
- Some employees may not show up (privacy settings)
- Some titles may be misclassified
- Some companies have more than 20 relevant employees (only get top 20)

### 3. Legal Compliance
- Use for business purposes only
- Don't spam employees
- Respect LinkedIn ToS
- Don't sell the data

### 4. Authentication
- Solve checkpoints manually when they appear
- Don't create multiple accounts
- Use same account for company + employee scraping

## 🎯 Next Steps

After scraping employees:

1. **Enrich data** - Add emails, phone numbers (use other tools)
2. **Segment lists** - Group by role, seniority, location
3. **Export to CRM** - Import into Salesforce, HubSpot, etc.
4. **Outreach** - Use for sales/recruitment campaigns

## 📞 Support

If you encounter issues:

1. Check this guide first
2. Read `SCRAPING_OPTIONS.md` for alternatives
3. Verify your `.env.local` credentials
4. Make sure you're logged into LinkedIn in browser

---

**Happy scraping! 🚀**

*Remember: Quality > Quantity. It's better to scrape 50 companies well than 500 companies and get banned.*
