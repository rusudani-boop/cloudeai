// lib/audit/types.ts

/* ============================================================================
 * CORE ENUMS & PRIMITIVES
 * ========================================================================== */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type FetchMethod = 'url' | 'html';

export interface FetchResult {
  html: string;
  status: number;
  finalUrl: string;
}

export type RenderMethod = 'ssr' | 'csr' | 'static' | 'unknown';

/* ============================================================================
 * AUDIT ISSUES
 * ========================================================================== */

export interface AuditIssue {
  readonly id: string;
  readonly severity: Severity;
  readonly category: string;
  readonly issue: string;
  readonly issueGe: string;
  readonly location: string;
  readonly fix: string;
  readonly fixGe: string;
  readonly current?: string;
  readonly details?: string;
}

/* ============================================================================
 * TECHNICAL SEO
 * ========================================================================== */

export interface TextMeta {
  value: string;
  visibleTitle?: string; // H1 tag content (visible title on page)
  length: number;
  isOptimal: boolean;
}

export interface TechnicalData {
  title: TextMeta;
  metaDesc: TextMeta;

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
    urlCount?: number;
    pageInSitemap?: boolean;
    sitemapCount?: number; // Number of sub-sitemaps in sitemap_index.xml
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

/* ============================================================================
 * INTERNATIONAL SEO
 * ========================================================================== */

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
  duplicateHreflangs: string[];
  nonCanonicalHreflangs: string[];
}

/* ============================================================================
 * CONTENT & READABILITY
 * ========================================================================== */

export interface ReadabilityData {
  fleschScore: number;
  fleschGrade: string;
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
  complexWordPercentage: number;
}

export interface KeywordDensityItem {
  word: string;
  count: number;
  percentage: number;
}

export interface ContentData {
  headings: Record<'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6', string[]>;
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
  keywordDensity: KeywordDensityItem[];

  detectedLanguage: 'ka' | 'ru' | 'de' | 'en' | 'es';
  titleLanguage: 'ka' | 'ru' | 'de' | 'en' | 'es' | null;
  titleContentLangMismatch: boolean | null;
}

/* ============================================================================
 * LINKS
 * ========================================================================== */

export interface LinkItem {
  href: string;
  text: string;
}

export interface RedirectLinkItem extends LinkItem {
  status: number;
  location: string;
}

export interface BrokenLinkItem extends LinkItem {
  status: number;
  error?: string;
}

export interface LinkData {
  total: number;
  internal: number;
  external: number;

  broken: number;
  brokenList: BrokenLinkItem[];

  genericAnchors: number;
  genericAnchorsList: LinkItem[];

  nofollow: number;
  sponsored: number;
  ugc: number;

  unsafeExternalCount: number;

  hasFooterLinks: boolean;
  hasNavLinks: boolean;

  internalUrls?: LinkItem[];
  externalUrls?: LinkItem[];

  redirectLinks?: number;
  redirectList?: RedirectLinkItem[];

  brokenExternalLinks?: number;
  brokenExternalList?: BrokenLinkItem[];
}

/* ============================================================================
 * IMAGES
 * ========================================================================== */

export interface ImageItem {
  src: string;
  alt: string;
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

  brokenCount?: number;
  brokenList?: ImageItem[];

  imageUrls?: ImageItem[];

  // Lists for displaying issues
  withoutAltList?: { src: string; context: string }[];
  withoutDimensionsList?: { src: string; alt: string }[];
  emptyAltList?: { src: string; context: string }[];

  imageSizeAnalysis?: {
    checked: number;
    largeCount: number;
    oldFormatCount: number;
    largeList: { src: string; size: string; type: string | null }[];
    oldFormatList: { src: string; type: string | null }[];
  };
}

/* ============================================================================
 * SCHEMA
 * ========================================================================== */

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

/* ============================================================================
 * SOCIAL META
 * ========================================================================== */

export interface SocialMeta {
  title: string | null;
  description: string | null;
  image: string | null;
  url?: string | null;
}

export interface SocialData {
  og: SocialMeta & {
    type: string | null;
    siteName: string | null;
    locale: string | null;
  };

  twitter: SocialMeta & {
    card: string | null;
    site: string | null;
    creator: string | null;
  };

  isComplete: boolean;
  hasArticleTags: boolean;
}

/* ============================================================================
 * ACCESSIBILITY
 * ========================================================================== */

export interface AriaData {
  landmarks: Record<
    'main' | 'nav' | 'header' | 'footer' | 'aside' | 'search' | 'form' | 'region',
    number
  >;

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
  contrastDetails: {
    lowContrastElements: { element: string; text: string; colors: string; ratio: string; section?: string }[];
    passedWCAG_AA: boolean;
    passedWCAG_AAA: boolean;
    score: number; // 0-100
    sectionIssues?: { section: string; count: number }[];
  };
  tablesWithoutHeaders: number;
  autoplayMedia: number;

  aria: AriaData;
}

/* ============================================================================
 * DOM & PERFORMANCE
 * ========================================================================== */

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

/* ============================================================================
 * SECURITY
 * ========================================================================== */

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

  ssl?: {
    valid: boolean;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    daysUntilExpiry?: number;
    error?: string;
  };

  securityHeaders?: {
    headers: Record<string, string | null>;
    score: number;
    issues: string[];
  };
}

/* ============================================================================
 * PLATFORM & TRUST
 * ========================================================================== */

export interface PlatformData {
  cms: string[];
  frameworks: string[];
  analytics: string[];
  advertising: string[];

  renderMethod: RenderMethod;
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

/* ============================================================================
 * MOBILE FRIENDLINESS
 * ========================================================================== */

export interface MobileData {
  // Viewport
  hasViewport: boolean;
  viewportContent: string | null;
  hasWidthDeviceWidth: boolean;
  hasInitialScale: boolean;
  hasUserScalable: boolean; // user-scalable=no is bad for accessibility

  // Touch & Tap Targets
  smallTapTargets: number; // Elements < 48px that are clickable
  tapTargetsList: { element: string; size: string }[];

  // Text Readability
  smallTextElements: number; // Text < 12px
  usesRelativeFontSizes: boolean; // em, rem, % vs px

  // Responsive Design
  hasMediaQueries: boolean;
  mediaQueryCount: number;
  hasFlexbox: boolean;
  hasGrid: boolean;

  // Content Width
  horizontalScrollRisk: boolean; // Fixed widths > 100vw
  fixedWidthElements: number;

  // Mobile-specific Meta
  hasThemeColor: boolean;
  hasAppleMobileWebAppCapable: boolean;
  hasAppleTouchIcon: boolean;
  hasManifest: boolean;

  // Responsive Images
  responsiveImagesCount: number; // srcset or picture
  totalImages: number;

  // Mobile Score
  score: number;
  issues: string[];
}

/* ============================================================================
 * EXTERNAL RESOURCES
 * ========================================================================== */

export interface ExternalResource {
  url: string;
  type: 'css' | 'js' | 'font' | 'image' | 'other';
  domain: string;
  isThirdParty: boolean;
}

export interface ExternalResourcesData {
  // Stylesheets
  cssFiles: { url: string; isThirdParty: boolean }[];
  cssCount: number;

  // JavaScript
  jsFiles: { url: string; isThirdParty: boolean; async: boolean; defer: boolean; module: boolean }[];
  jsCount: number;

  // Fonts
  fontFiles: { url: string; format: string | null }[];
  fontCount: number;
  googleFonts: string[]; // Font family names from Google Fonts

  // Third-party domains
  thirdPartyDomains: string[];
  thirdPartyCount: number;

  // Preconnect/DNS-Prefetch suggestions
  suggestedPreconnects: string[];
}

/* ============================================================================
 * AUDIT RESULT
 * ========================================================================== */

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
  fetchMethod: FetchMethod;

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
  mobile: MobileData;
  externalResources: ExternalResourcesData;

  issues: AuditIssue[];
  passed: string[];
}
