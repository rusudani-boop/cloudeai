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
    xRobotsTag: string | null;
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
  llmsTxt: {
    found: boolean;
    mentioned: boolean;
  };
  language: string | null;
  charset: string | null;
  viewport: {
    content: string | null;
    isMobileOptimized: boolean;
  };
  favicon: boolean;
  appleTouchIcon: boolean;
  manifestJson: boolean;
  themeColor: string | null;
}

export interface HreflangTag {
  hreflang: string;
  href: string;
}

export interface InternationalData {
  hreflangs: HreflangTag[];
  hasXDefault: boolean;
  hasSelfReference: boolean;
  canonicalInHreflang: boolean;
  langMatchesHreflang: boolean;
  issues: string[];
}

export interface ReadabilityData {
  fleschScore: number;
  fleschGrade: string;
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
  complexWordPercentage: number;
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
  characterCount: number;
  sentenceCount: number;
  paragraphCount: number;
  readingTime: number;
  titleH1Duplicate: boolean;
  duplicateParagraphs: number;
  aiScore: number;
  aiPhrases: string[];
  readability: ReadabilityData;
  keywordDensity: { word: string; count: number; percentage: number }[];
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
  sponsored: number;
  ugc: number;
  unsafeExternalCount: number;
  hasFooterLinks: boolean;
  hasNavLinks: boolean;
}

export interface ImageData {
  total: number;
  withoutAlt: number;
  withEmptyAlt: number;
  withoutDimensions: number;
  lazyLoaded: number;
  lazyAboveFold: number;
  clickableWithoutAlt: number;
  decorativeCount: number;
  largeImages: number;
  modernFormats: number;
  srcsetCount: number;
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
  hasWebSiteSearch: boolean;
  hasBreadcrumb: boolean;
  hasOrganization: boolean;
  hasFAQ: boolean;
  hasHowTo: boolean;
}

export interface SocialData {
  og: {
    title: string | null;
    description: string | null;
    image: string | null;
    url: string | null;
    type: string | null;
    siteName: string | null;
    locale: string | null;
  };
  twitter: {
    card: string | null;
    site: string | null;
    creator: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
  };
  isComplete: boolean;
  hasArticleTags: boolean;
}

export interface AriaData {
  landmarks: {
    main: number;
    nav: number;
    header: number;
    footer: number;
    aside: number;
    search: number;
    form: number;
    region: number;
  };
  ariaLabels: number;
  ariaDescribedby: number;
  ariaLabelledby: number;
  ariaHidden: number;
  ariaLive: number;
  ariaExpanded: number;
  roles: string[];
  missingLandmarks: string[];
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
  hasMainLandmark: boolean;
  hasNavLandmark: boolean;
  hasFocusVisible: boolean;
  colorContrastIssues: number;
  aria: AriaData;
  tablesWithoutHeaders: number;
  autoplayMedia: number;
}

export interface DOMData {
  totalElements: number;
  maxDepth: number;
  averageDepth: number;
  totalNodes: number;
  textNodes: number;
  commentNodes: number;
  inlineStyles: number;
  inlineScripts: number;
  emptyElements: number;
  deprecatedElements: string[];
  duplicateIds: string[];
  elementCounts: Record<string, number>;
}

export interface PerformanceData {
  totalScripts: number;
  totalStylesheets: number;
  renderBlockingScripts: number;
  renderBlockingStyles: number;
  asyncScripts: number;
  deferScripts: number;
  moduleScripts: number;
  inlineScripts: number;
  inlineStyles: number;
  preloads: number;
  preloadsWithoutAs: number;
  preconnects: number;
  prefetches: number;
  dnsPrefetches: number;
  fontsWithoutDisplay: number;
  webFonts: number;
  criticalCssInlined: boolean;
  hasServiceWorker: boolean;
  htmlSize: number;
  estimatedWeight: string;
}

export interface SecurityData {
  isHttps: boolean;
  mixedContentCount: number;
  mixedContentUrls: string[];
  protocolRelativeCount: number;
  unsafeExternalLinks: number;
  hasCSP: boolean;
  hasXFrameOptions: boolean;
  hasXContentTypeOptions: boolean;
  hasReferrerPolicy: boolean;
  hasCORS: boolean;
  formWithoutAction: number;
  passwordFieldWithoutAutocomplete: number;
}

export interface PlatformData {
  cms: string[];
  frameworks: string[];
  analytics: string[];
  advertising: string[];
  renderMethod: string;
  isCSR: boolean;
  isPWA: boolean;
  hasAMP: boolean;
}

export interface TrustSignalsData {
  hasAboutPage: boolean;
  hasContactPage: boolean;
  hasPrivacyPage: boolean;
  hasTermsPage: boolean;
  hasCookiePolicy: boolean;
  hasAuthor: boolean;
  hasPublishDate: boolean;
  hasModifiedDate: boolean;
  hasCopyright: boolean;
  hasAddress: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  socialLinksCount: number;
  socialPlatforms: string[];
  hasSSLBadge: boolean;
  hasPaymentBadges: boolean;
  hasReviews: boolean;
  hasCertifications: boolean;
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
  dom: DOMData;
  performance: PerformanceData;
  security: SecurityData;
  platform: PlatformData;
  trustSignals: TrustSignalsData;
  issues: AuditIssue[];
  passed: string[];
}
