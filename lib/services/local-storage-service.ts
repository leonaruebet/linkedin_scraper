import fs from 'fs';
import path from 'path';
import { LinkedInProfile, LinkedInCompany } from '../types/linkedin';

export class LocalStorageService {
  private dataDir = path.join(process.cwd(), 'scraped-data');
  private profilesFile = path.join(this.dataDir, 'profiles.json');
  private companiesFile = path.join(this.dataDir, 'companies.json');

  constructor() {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Initialize files if they don't exist
    if (!fs.existsSync(this.profilesFile)) {
      fs.writeFileSync(this.profilesFile, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(this.companiesFile)) {
      fs.writeFileSync(this.companiesFile, JSON.stringify([], null, 2));
    }
  }

  // Profile methods
  saveProfile(profile: LinkedInProfile): void {
    const profiles = this.loadProfiles();

    // Check if profile already exists
    const index = profiles.findIndex(p => p.publicIdentifier === profile.publicIdentifier);

    if (index >= 0) {
      // Update existing profile
      profiles[index] = { ...profile, lastUpdated: new Date() };
    } else {
      // Add new profile
      profiles.push(profile);
    }

    fs.writeFileSync(this.profilesFile, JSON.stringify(profiles, null, 2));
  }

  loadProfiles(): LinkedInProfile[] {
    const data = fs.readFileSync(this.profilesFile, 'utf-8');
    return JSON.parse(data);
  }

  getProfile(publicIdentifier: string): LinkedInProfile | null {
    const profiles = this.loadProfiles();
    return profiles.find(p => p.publicIdentifier === publicIdentifier) || null;
  }

  // Company methods
  saveCompany(company: LinkedInCompany): void {
    const companies = this.loadCompanies();

    const index = companies.findIndex(c => c.universalName === company.universalName);

    if (index >= 0) {
      companies[index] = { ...company, lastUpdated: new Date() };
    } else {
      companies.push(company);
    }

    fs.writeFileSync(this.companiesFile, JSON.stringify(companies, null, 2));
  }

  loadCompanies(): LinkedInCompany[] {
    const data = fs.readFileSync(this.companiesFile, 'utf-8');
    return JSON.parse(data);
  }

  getCompany(universalName: string): LinkedInCompany | null {
    const companies = this.loadCompanies();
    return companies.find(c => c.universalName === universalName) || null;
  }

  // Export specific search results
  saveSearchResults(searchName: string, profiles: LinkedInProfile[]): string {
    const filename = `${searchName.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.json`;
    const filepath = path.join(this.dataDir, filename);

    fs.writeFileSync(filepath, JSON.stringify({
      searchName,
      timestamp: new Date().toISOString(),
      totalResults: profiles.length,
      profiles
    }, null, 2));

    return filepath;
  }

  // Statistics
  getStats(): { totalProfiles: number; totalCompanies: number } {
    return {
      totalProfiles: this.loadProfiles().length,
      totalCompanies: this.loadCompanies().length
    };
  }
}

export const localStorage = new LocalStorageService();
