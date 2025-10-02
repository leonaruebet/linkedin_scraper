# ⚡ Quick Start: Fast Employee Scraping

## What You Get

✅ **4 employees per company** (sales & management)
✅ **Email & phone** extracted
✅ **Fast with proxies** (1-2 hours) or **free without** (5-6 hours)
✅ **969 companies** = ~3,876 employees

---

## 🚀 Option 1: Fast with Proxies (Recommended)

### Setup (5 minutes)

1. **Get proxies** ($35-75/month):
   - Budget: [IPRoyal](https://iproyal.com) - $35
   - Best: [SmartProxy](https://smartproxy.com) - $75

2. **Configure `.env.local`**:
   ```bash
   # LinkedIn
   LINKEDIN_EMAIL=your-email@example.com
   LINKEDIN_PASSWORD=your-password

   # Proxies (copy from your proxy dashboard)
   PROXY_1=http://pr.smartproxy.com:10001
   PROXY_1_USER=your-username
   PROXY_1_PASS=your-password

   PROXY_2=http://pr.smartproxy.com:10002
   PROXY_2_USER=your-username
   PROXY_2_PASS=your-password

   # Add 3-5 proxies for best speed
   ```

3. **Run**:
   ```bash
   npm run reset:browser
   # Wait 1 hour
   npm run scrape:employees:fast
   ```

**Result:** ~3,876 employees in 1-2 hours 🚀

---

## 🐢 Option 2: Free (No Proxies)

### Setup (1 minute)

1. **Configure `.env.local`**:
   ```bash
   LINKEDIN_EMAIL=your-email@example.com
   LINKEDIN_PASSWORD=your-password
   ```

2. **Run**:
   ```bash
   npm run reset:browser
   # Wait 1 hour
   npm run scrape:employees:fast
   ```

**Result:** ~3,876 employees in 5-6 hours 🐢

---

## 📊 Output Data

### File: `scraped-data/employees-with-contact.json`

```json
{
  "fullName": "John Doe",
  "email": "john.doe@company.com",
  "phone": "+66 2 123 4567",
  "currentTitle": "Sales Director",
  "currentCompany": "Tech Company",
  "department": "Sales",
  "seniorityLevel": "Director",
  "location": "Bangkok, Thailand",
  "profileUrl": "https://linkedin.com/in/john-doe/"
}
```

### View Results:

```bash
# Count total
cat scraped-data/employees-with-contact.json | jq length

# View first 5
cat scraped-data/employees-with-contact.json | jq '.[0:5]'

# Export to CSV
cat scraped-data/employees-with-contact.json | jq -r '.[] | [.fullName, .email, .phone, .currentTitle, .currentCompany] | @csv' > employees.csv

# Filter sales only
cat scraped-data/employees-with-contact.json | jq '.[] | select(.department == "Sales")' > sales-employees.json
```

---

## 🎯 Expected Results

| Metric | Without Proxies | With 5 Proxies |
|--------|----------------|----------------|
| **Time** | 5-6 hours | 1-2 hours |
| **Cost** | Free | $75/month |
| **Employees** | ~3,876 | ~3,876 |
| **With Email** | ~50-70% | ~50-70% |
| **Ban Risk** | Medium | Low |

---

## 🛡️ Avoiding Bans

### Already done for you:
- ✅ Auto browser reset
- ✅ Random delays
- ✅ Auth validation
- ✅ Checkpoint detection

### You should:
1. ⏰ Wait 1 hour after `npm run reset:browser`
2. 🧪 Test first: `MAX_COMPANIES=5 npm run scrape:employees:fast`
3. 📅 Don't run 24/7 (take breaks)

---

## 🔧 Troubleshooting

### Checkpoint appears?
```bash
npm run reset:browser
# Wait 2 hours
# Try with VPN
npm run scrape:employees:fast
```

### No emails/phones?
Normal! Only ~50-70% of profiles have public contact info.

### Want to verify emails?
Use [NeverBounce](https://neverbounce.com) ($0.008/email)

### Need help?
Read: `PROXY_SETUP.md` (full guide)

---

## 💡 Pro Tips

### 1. Start Small
```bash
MAX_COMPANIES=10 npm run scrape:employees:fast
```

### 2. Use Proxies for Speed
5 proxies = 5x faster (1-2 hours vs 5-6 hours)

### 3. Export to CRM
Import `employees.csv` to Salesforce, HubSpot, etc.

### 4. Enrich Later
Use Apollo.io or Hunter.io to find missing emails

---

## 📚 Full Documentation

- **PROXY_SETUP.md** - Proxy configuration guide
- **EMPLOYEE_SCRAPER_GUIDE.md** - Detailed employee scraper guide
- **AVOID_DETECTION.md** - Anti-ban strategies
- **SCRAPING_OPTIONS.md** - Alternative approaches

---

## ⚡ TL;DR

```bash
# 1. Add credentials to .env.local
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password

# 2. (Optional) Add proxies for 5x speed
PROXY_1=http://...
PROXY_2=http://...

# 3. Reset & Run
npm run reset:browser
# Wait 1 hour
npm run scrape:employees:fast

# 4. Export
cat scraped-data/employees-with-contact.json | jq -r '.[] | [.fullName, .email, .phone] | @csv' > employees.csv
```

**Done!** 🎉
