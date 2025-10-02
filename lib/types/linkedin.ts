export interface LinkedInProfile {
  _id?: string;
  linkedinId: string;
  publicIdentifier: string;
  firstName: string;
  lastName: string;
  headline?: string;
  summary?: string;
  location?: string;
  industry?: string;
  photoUrl?: string;
  connections?: number;
  experience?: Experience[];
  education?: Education[];
  skills?: string[];
  profileUrl: string;
  scrapedAt: Date;
  lastUpdated: Date;
}

export interface Experience {
  title: string;
  company: string;
  companyId?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export interface Education {
  school: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface LinkedInCompany {
  _id?: string;
  linkedinId: string;
  universalName: string;
  name: string;
  description?: string;
  industry?: string;
  website?: string;
  headquarters?: string;
  companySize?: string;
  employeeCount?: number;
  followers?: number;
  logoUrl?: string;
  companyUrl: string;
  scrapedAt: Date;
  lastUpdated: Date;
}

export interface LinkedInPost {
  _id?: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  likes?: number;
  comments?: number;
  shares?: number;
  postedAt?: Date;
  postUrl: string;
  scrapedAt: Date;
}

export interface ScrapingTask {
  _id?: string;
  type: 'profile' | 'company' | 'search';
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  priority: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

export interface SearchCriteria {
  keywords?: string;
  location?: string;
  company?: string;
  title?: string;
  industry?: string;
  limit?: number;
}
