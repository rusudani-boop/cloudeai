// lib/audit/types.ts

export interface AuditIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  issueGe: string;
  location: string;
  fix: string;
  fixGe: string;
  current?: string;
  details?: string;
}

export interface TechnicalData {
  title: {
    value: string;
    length: number;
    isOptimal: boolean;
  };
  metaDesc: {
    value: string;
    length: number;
    isOptimal: boolean;
  };
  canonical: {
    href: string | null;
    count: number;
    isCrossDomain: boolean;
  };
  robots: {
    meta: string | null;
    hasNoindex: boolean;
    hasNofollow: boolean;
  };
  robotsTxt: {
    found: boolean;
    content: string | null;
    blocksAll: boolean;
    hasSitemap: boolean;
  };
  sitemap: {
    found: boolean;
    url: string | null;
  };
  language: string | null;
  charset: string | null;
  viewport: {
    content: string | null;
    isMobileOptimized: boolean;
  };
  favicon: boolean;
  appleTouchIcon: boolean;
}

export interface HreflangTag {
  hreflang: string;
  href: string;
}

export interface InternationalData {
  hreflangs: HreflangTag[];
  hasXDefault: boolean;
  hasSelfReference: boolean;
  issues: string[];
}

export interface ContentData {
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
  };
  wordCount: number;
  readingTime: number;
  titleH1Duplicate: boolean;
  duplicateParagraphs: number;
  aiScore: number;
  aiPhrases: string[];
}

export interface LinkData {
  total: number;
  internal: number;
  external: number;
  broken: number;
  brokenList: { href: string; text: string }[];
  genericAnchors: number;
  genericAnchorsList: { text: string; href: string }[];
  nofollow: number;
  unsafeExternalCount: number;
}

export interface ImageData {
  total: number;
  withoutAlt: number;
  withoutDimensions: number;
  lazyLoaded: number;
  lazyAboveFold: number;
  clickableWithoutAlt: number;
}

export interface SchemaItem {
  index: string;
  type: string;
  valid: boolean;
  issues: string[];
}

export interface SchemaData {
  count: number;
  types: string[];
  valid: number;
  invalid: number;
  details: SchemaItem[];
  missingContext: number;
}

export interface SocialData {
  og: {
    title: string | null;
    description: string | null;
    image: string | null;
    url: string | null;
    type: string | null;
  };
  twitter: {
    card: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
  };
  isComplete: boolean;
}

export interface AccessibilityData {
  buttonsWithoutLabel: number;
  inputsWithoutLabel: number;
  linksWithoutText: number;
  iframesWithoutTitle: number;
  skippedHeadings: string[];
  hasSkipLink: boolean;
  hasLangAttribute: boolean;
  clickableImagesWithoutAlt: number;
  positiveTabindex: number;
}

export interface PerformanceData {
  totalScripts: number;
  totalStylesheets: number;
  renderBlockingScripts: number;
  renderBlockingStyles: number;
  preloads: number;
  preloadsWithoutAs: number;
  preconnects: number;
  prefetches: number;
  dnsPrefetches: number;
  fontsWithoutDisplay: number;
}

export interface SecurityData {
  isHttps: boolean;
  mixedContentCount: number;
  mixedContentUrls: string[];
  protocolRelativeCount: number;
  unsafeExternalLinks: number;
}

export interface PlatformData {
  cms: string[];
  frameworks: string[];
  renderMethod: string;
  isCSR: boolean;
}

export interface TrustSignalsData {
  hasAboutPage: boolean;
  hasContactPage: boolean;
  hasPrivacyPage: boolean;
  hasAuthor: boolean;
  socialLinksCount: number;
  socialPlatforms: string[];
}

export interface AuditSummary {
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalChecks: number;
  passedChecks: number;
}

export interface AuditResult {
  url: string;
  score: number;
  timestamp: string;
  fetchMethod: 'url' | 'html';
  summary: AuditSummary;
  technical: TechnicalData;
  international: InternationalData;
  content: ContentData;
  links: LinkData;
  images: ImageData;
  schema: SchemaData;
  social: SocialData;
  accessibility: AccessibilityData;
  performance: PerformanceData;
  security: SecurityData;
  platform: PlatformData;
  trustSignals: TrustSignalsData;
  issues: AuditIssue[];
  passed: string[];
}
