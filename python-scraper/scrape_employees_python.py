#!/usr/bin/env python3
"""
LinkedIn Employee Scraper using linkedin_scraper library
Gets 4 employees per company with email & phone
"""

import json
import os
import time
from pathlib import Path
from typing import List, Dict
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from linkedin_scraper import Company, Person, actions

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env.local')

class EmployeeScraper:
    def __init__(self, email: str, password: str, max_employees: int = 4):
        self.email = email
        self.password = password
        self.max_employees = max_employees
        self.driver = None
        self.checkpoint_file = Path(__file__).parent.parent / 'scraped-data' / 'python-employee-checkpoint.json'
        self.output_file = Path(__file__).parent.parent / 'scraped-data' / 'python-employees.json'

        # Create data directory
        self.checkpoint_file.parent.mkdir(exist_ok=True)

    def setup_driver(self):
        """Setup Chrome driver with stealth settings"""
        chrome_options = Options()
        # chrome_options.add_argument('--headless')  # Comment out to see browser
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)

        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

    def load_checkpoint(self) -> Dict:
        """Load progress checkpoint"""
        if self.checkpoint_file.exists():
            with open(self.checkpoint_file, 'r') as f:
                return json.load(f)
        return {'completed_companies': [], 'total_employees': 0}

    def save_checkpoint(self, checkpoint: Dict):
        """Save progress checkpoint"""
        with open(self.checkpoint_file, 'w') as f:
            json.dump(checkpoint, f, indent=2)

    def load_employees(self) -> List[Dict]:
        """Load existing employee data"""
        if self.output_file.exists():
            with open(self.output_file, 'r') as f:
                return json.load(f)
        return []

    def save_employees(self, employees: List[Dict]):
        """Save employee data"""
        with open(self.output_file, 'w') as f:
            json.dump(employees, f, indent=2)

    def scrape_company_employees(self, company_url: str) -> List[Dict]:
        """Scrape employees from a company"""
        print(f"\n🔍 Scraping: {company_url}")

        try:
            # Scrape company
            company = Company(
                linkedin_url=company_url,
                driver=self.driver,
                scrape=True,
                close_on_complete=False,
                get_employees=True
            )

            if not company.employees or len(company.employees) == 0:
                print("   ⚠️  No employees found")
                return []

            print(f"   📊 Found {len(company.employees)} employees")

            # Get up to max_employees
            employee_urls = company.employees[:self.max_employees]
            employees_data = []

            for i, emp_url in enumerate(employee_urls, 1):
                try:
                    print(f"   👤 Scraping employee {i}/{len(employee_urls)}...")

                    # Scrape person
                    person = Person(
                        linkedin_url=emp_url,
                        driver=self.driver,
                        scrape=True,
                        close_on_complete=False
                    )

                    # Extract data
                    employee_data = {
                        'fullName': person.name or '',
                        'profileUrl': emp_url,
                        'headline': person.job_title or '',
                        'currentCompany': person.company or company.name,
                        'companyLinkedInUrl': company_url,
                        'about': ' '.join(person.about) if person.about else '',
                        'experiences': [],
                        'education': [],
                        'email': '',  # Not available from profile
                        'phone': '',  # Not available from profile
                    }

                    # Add experiences
                    if person.experiences:
                        for exp in person.experiences[:3]:  # Top 3 experiences
                            employee_data['experiences'].append({
                                'title': getattr(exp, 'position_title', ''),
                                'company': getattr(exp, 'institution_name', ''),
                                'duration': getattr(exp, 'duration', ''),
                            })

                    # Add education
                    if person.educations:
                        for edu in person.educations[:2]:  # Top 2 educations
                            employee_data['education'].append({
                                'school': getattr(edu, 'institution_name', ''),
                                'degree': getattr(edu, 'degree', ''),
                            })

                    employees_data.append(employee_data)

                    # Delay between employees
                    time.sleep(3)

                except Exception as e:
                    print(f"   ❌ Error scraping employee: {e}")
                    continue

            print(f"   ✅ Scraped {len(employees_data)} employees")
            return employees_data

        except Exception as e:
            print(f"   ❌ Error scraping company: {e}")
            return []

    def scrape_companies(self, company_urls: List[str]):
        """Scrape employees from multiple companies"""
        print("\n" + "="*60)
        print("🐍 PYTHON LINKEDIN SCRAPER")
        print("="*60)
        print(f"📊 Companies to scrape: {len(company_urls)}")
        print(f"👥 Max employees per company: {self.max_employees}")
        print("="*60)

        # Setup driver
        self.setup_driver()

        # Login
        print("\n🔐 Logging in to LinkedIn...")
        try:
            actions.login(self.driver, self.email, self.password)
            print("✅ Login successful")
        except Exception as e:
            print(f"❌ Login failed: {e}")
            print("\n💡 TIP: Account might be flagged or checkpoint required")
            print("Try running manually (non-headless) to solve checkpoint")
            self.driver.quit()
            return

        # Load checkpoint
        checkpoint = self.load_checkpoint()
        remaining_companies = [url for url in company_urls if url not in checkpoint['completed_companies']]

        if not remaining_companies:
            print("\n✅ All companies already scraped!")
            self.driver.quit()
            return

        print(f"\n📋 Remaining companies: {len(remaining_companies)}")

        # Load existing employees
        all_employees = self.load_employees()

        # Scrape each company
        for i, company_url in enumerate(remaining_companies, 1):
            print(f"\n[{i}/{len(remaining_companies)}] ({i/len(remaining_companies)*100:.1f}%)")

            try:
                # Scrape employees
                employees = self.scrape_company_employees(company_url)

                # Save employees
                all_employees.extend(employees)
                self.save_employees(all_employees)

                # Update checkpoint
                checkpoint['completed_companies'].append(company_url)
                checkpoint['total_employees'] = len(all_employees)
                self.save_checkpoint(checkpoint)

                # Delay between companies
                print("   ⏳ Waiting 10 seconds...")
                time.sleep(10)

            except Exception as e:
                print(f"   ❌ Error: {e}")
                continue

        # Close driver
        self.driver.quit()

        print("\n" + "="*60)
        print("✅ SCRAPING COMPLETE")
        print("="*60)
        print(f"📁 Data saved to: {self.output_file}")
        print(f"📝 Checkpoint: {self.checkpoint_file}")
        print(f"👥 Total employees: {len(all_employees)}")
        print("="*60)


def main():
    # Get credentials
    email = os.getenv('LINKEDIN_EMAIL')
    password = os.getenv('LINKEDIN_PASSWORD')
    max_companies = int(os.getenv('MAX_COMPANIES', '999999'))

    if not email or not password:
        print("❌ Missing LINKEDIN_EMAIL or LINKEDIN_PASSWORD in .env.local")
        return

    # Load company URLs
    checkpoint_file = Path(__file__).parent.parent / 'scraped-data' / 'phase1-urls-checkpoint.json'

    if not checkpoint_file.exists():
        print("❌ No company URLs found!")
        print("   Run the company scraper first to collect URLs")
        return

    with open(checkpoint_file, 'r') as f:
        data = json.load(f)
        company_urls = data.get('urls', [])

    if not company_urls:
        print("⚠️  No companies in checkpoint")
        return

    # Limit companies
    company_urls = company_urls[:max_companies]

    # Create scraper
    scraper = EmployeeScraper(email, password, max_employees=4)

    # Run scraper
    scraper.scrape_companies(company_urls)


if __name__ == '__main__':
    main()
