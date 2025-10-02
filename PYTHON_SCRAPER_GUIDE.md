# 🐍 Python LinkedIn Scraper Guide

## Overview

Alternative scraper using Python's `linkedin_scraper` library. This might avoid some detection issues since it's a different implementation.

## 🎯 What It Does

- ✅ Scrapes company profiles
- ✅ Gets employees from each company (4 per company)
- ✅ Extracts name, title, experience, education
- ✅ Auto-login and checkpoint handling
- ✅ Resume from checkpoint

**Note:** This library **cannot** extract email/phone directly from LinkedIn profiles (LinkedIn restriction).

## 📦 Setup

### 1. Install Python Dependencies

```bash
cd python-scraper
pip3 install -r requirements.txt
```

### 2. Install ChromeDriver

**macOS:**
```bash
brew install chromedriver
export CHROMEDRIVER=/opt/homebrew/bin/chromedriver
```

**Linux:**
```bash
wget https://chromedriver.storage.googleapis.com/LATEST_RELEASE
wget https://chromedriver.storage.googleapis.com/`cat LATEST_RELEASE`/chromedriver_linux64.zip
unzip chromedriver_linux64.zip
sudo mv chromedriver /usr/local/bin/
export CHROMEDRIVER=/usr/local/bin/chromedriver
```

**Windows:**
- Download from https://chromedriver.chromium.org/
- Extract to `C:\chromedriver\`
- Set environment: `set CHROMEDRIVER=C:\chromedriver\chromedriver.exe`

### 3. Configure Credentials

Make sure `.env.local` has:
```bash
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password
MAX_COMPANIES=10  # Optional: limit companies
```

## 🚀 Usage

### Basic Run

```bash
cd python-scraper
python3 scrape_employees_python.py
```

### Test with Limited Companies

```bash
MAX_COMPANIES=5 python3 scrape_employees_python.py
```

### Resume After Interruption

Just run again - it auto-resumes from checkpoint:
```bash
python3 scrape_employees_python.py
```

## 📊 Output

### File: `scraped-data/python-employees.json`

```json
[
  {
    "fullName": "John Doe",
    "profileUrl": "https://linkedin.com/in/john-doe/",
    "headline": "Sales Director",
    "currentCompany": "Tech Company",
    "companyLinkedInUrl": "https://linkedin.com/company/tech-company/",
    "about": "Passionate sales leader with 10 years experience...",
    "experiences": [
      {
        "title": "Sales Director",
        "company": "Tech Company",
        "duration": "2 years"
      }
    ],
    "education": [
      {
        "school": "Harvard University",
        "degree": "MBA"
      }
    ],
    "email": "",
    "phone": ""
  }
]
```

### File: `scraped-data/python-employee-checkpoint.json`

Progress tracking:
```json
{
  "completed_companies": [
    "https://linkedin.com/company/company1/",
    "https://linkedin.com/company/company2/"
  ],
  "total_employees": 8
}
```

## 🆚 Python vs TypeScript Scraper

| Feature | Python (linkedin_scraper) | TypeScript (Our Custom) |
|---------|--------------------------|-------------------------|
| **Setup** | Easier (pip install) | Medium (npm install) |
| **Speed** | Slower (no parallel) | Faster (parallel workers) |
| **Email/Phone** | ❌ Not available | ✅ Extracted (50-70%) |
| **Detection** | Lower (different library) | Medium |
| **Checkpoints** | Less frequent | More frequent |
| **Proxy Support** | ❌ No | ✅ Yes |
| **Maintenance** | Community library | Custom code |

## ⚡ Performance

### Without Proxies:
- **Speed:** ~1 company per minute
- **Time for 969 companies:** ~16 hours
- **Employees:** ~3,876 (4 per company)

### Advantages:
- ✅ Different implementation (less detection)
- ✅ Maintained library (bug fixes)
- ✅ Simpler code
- ✅ Better for small batches

### Disadvantages:
- ❌ Slower (no parallelization)
- ❌ No email/phone extraction
- ❌ No proxy support (yet)

## 🔧 Customization

### Change Employees Per Company

Edit `scrape_employees_python.py`:
```python
scraper = EmployeeScraper(email, password, max_employees=10)  # Get 10 instead of 4
```

### Add Proxy Support

Edit `setup_driver()` method:
```python
def setup_driver(self):
    chrome_options = Options()
    chrome_options.add_argument('--proxy-server=http://proxy:port')
    self.driver = webdriver.Chrome(options=chrome_options)
```

### Extract More Data

The library provides access to:
- `person.accomplishments`
- `person.interests`
- `person.contacts` (if available)

Add to `scrape_company_employees()`:
```python
employee_data['accomplishments'] = person.accomplishments
employee_data['interests'] = person.interests
```

## 🛡️ Avoiding Detection

### Best Practices:

1. **Use Visible Browser** (not headless)
   ```python
   # Comment out this line in setup_driver():
   # chrome_options.add_argument('--headless')
   ```

2. **Slow Down**
   ```python
   # Increase delays in scrape_companies():
   time.sleep(30)  # Instead of 10
   ```

3. **Small Batches**
   ```bash
   MAX_COMPANIES=20 python3 scrape_employees_python.py
   ```

4. **Daily Limits**
   - Scrape max 50 companies/day
   - Take breaks between runs

## 🔄 Combining Python + TypeScript

Use both for best results:

### Strategy 1: Python for Profiles, TypeScript for Contact

```bash
# 1. Get profiles with Python (less detection)
cd python-scraper
python3 scrape_employees_python.py

# 2. Extract emails from websites with TypeScript
npm run scrape:employees:fast
```

### Strategy 2: Compare Results

```bash
# Scrape with both
python3 python-scraper/scrape_employees_python.py
npm run scrape:employees:fast

# Merge results (unique employees only)
```

## 📈 Expected Results (969 Companies)

### Python Scraper:
- **Time:** ~16 hours (1 company/min)
- **Employees:** ~3,876
- **With Email:** 0% (not extracted)
- **Checkpoint Risk:** Low

### Recommendation:
Use Python scraper if:
- You keep getting checkpoints with TypeScript
- You don't need email/phone
- You want more stable scraping
- You're okay with slower speed

## 🆘 Troubleshooting

### "ChromeDriver not found"
```bash
# Set path manually
export CHROMEDRIVER=/path/to/chromedriver

# Or install via brew (macOS)
brew install chromedriver
```

### "Login Failed"
- Solve checkpoint manually in browser
- Script will wait for you
- Press Enter when done

### "No employees found"
- Normal for some companies
- Company privacy settings
- Try larger companies

### "Too Slow"
- Run in batches
- Don't exceed 50 companies/day
- Quality over speed

## 💡 Pro Tips

### 1. Run Overnight

```bash
# Start before bed
nohup python3 scrape_employees_python.py > scraper.log 2>&1 &

# Check progress in morning
cat scraped-data/python-employee-checkpoint.json
```

### 2. Monitor Progress

```bash
# In another terminal
watch -n 10 'cat scraped-data/python-employee-checkpoint.json | jq .total_employees'
```

### 3. Export to CSV

```python
import json
import csv

# Load data
with open('scraped-data/python-employees.json') as f:
    employees = json.load(f)

# Export
with open('employees.csv', 'w') as f:
    writer = csv.DictWriter(f, fieldnames=['fullName', 'headline', 'currentCompany'])
    writer.writeheader()
    writer.writerows(employees)
```

## 🎯 Next Steps

1. **Install:** `pip3 install -r python-scraper/requirements.txt`
2. **Test:** `MAX_COMPANIES=5 python3 python-scraper/scrape_employees_python.py`
3. **Run:** `python3 python-scraper/scrape_employees_python.py`
4. **Wait:** Let it run (can take hours)
5. **Export:** Convert JSON to CSV

---

**The Python scraper is a good alternative if TypeScript keeps hitting checkpoints!** 🐍
