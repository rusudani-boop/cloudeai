'use client';

import React, { useState, useCallback } from 'react';

// Types matching the updated audit system
interface AuditIssue {
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

interface HreflangTag { hreflang: string; href: string; }
interface SchemaItem { index: string; type: string; valid: boolean; issues: string[]; }
interface KeywordDensity { word: string; count: number; percentage: number; }
interface ReadabilityData { fleschScore: number; fleschGrade: string; avgSentenceLength: number; avgSyllablesPerWord: number; complexWordPercentage: number; }
interface AriaData { landmarks: { main: number; nav: number; header: number; footer: number; aside: number; search: number; form: number; region: number }; ariaLabels: number; ariaDescribedby: number; ariaLabelledby: number; ariaHidden: number; ariaLive: number; ariaExpanded: number; roles: string[]; missingLandmarks: string[]; }
interface DOMData { totalElements: number; maxDepth: number; averageDepth: number; totalNodes: number; textNodes: number; commentNodes: number; inlineStyles: number; inlineScripts: number; emptyElements: number; deprecatedElements: string[]; duplicateIds: string[]; elementCounts: Record<string, number>; }

interface AuditResult {
  url: string;
  score: number;
  timestamp: string;
  fetchMethod: 'url' | 'html';
  summary: { criticalIssues: number; highIssues: number; mediumIssues: number; lowIssues: number; totalChecks: number; passedChecks: number; };
  technical: { title: { value: string; length: number; isOptimal: boolean }; metaDesc: { value: string; length: number; isOptimal: boolean }; canonical: { href: string | null; count: number; isCrossDomain: boolean }; robots: { meta: string | null; hasNoindex: boolean; hasNofollow: boolean }; robotsTxt: { found: boolean; content: string | null; blocksAll: boolean; hasSitemap: boolean }; sitemap: { found: boolean; url: string | null; urlCount?: number; pageInSitemap?: boolean }; llmsTxt: { found: boolean; mentioned: boolean }; language: string | null; charset: string | null; viewport: { content: string | null; isMobileOptimized: boolean }; favicon: boolean; appleTouchIcon: boolean; manifestJson: boolean; themeColor: string | null; };
  international: { hreflangs: HreflangTag[]; hasXDefault: boolean; hasSelfReference: boolean; canonicalInHreflang: boolean; langMatchesHreflang: boolean; issues: string[]; duplicateHreflangs?: string[]; nonCanonicalHreflangs?: string[]; };
  content: { headings: { h1: string[]; h2: string[]; h3: string[]; h4: string[]; h5: string[]; h6: string[] }; wordCount: number; characterCount: number; sentenceCount: number; paragraphCount: number; readingTime: number; titleH1Duplicate: boolean; duplicateParagraphs: number; aiScore: number; aiPhrases: string[]; readability: ReadabilityData; keywordDensity: KeywordDensity[]; detectedLanguage?: string; };
  links: { total: number; internal: number; external: number; broken: number; brokenList: { href: string; text: string }[]; genericAnchors: number; genericAnchorsList: { text: string; href: string }[]; nofollow: number; sponsored: number; ugc: number; unsafeExternalCount: number; hasFooterLinks: boolean; hasNavLinks: boolean; internalUrls?: { href: string; text: string }[]; externalUrls?: { href: string; text: string }[]; redirectLinks?: number; redirectList?: { href: string; text: string; status: number; location: string }[]; brokenExternalLinks?: number; brokenExternalList?: { href: string; text: string; status: number; error?: string }[]; };
  images: { total: number; withoutAlt: number; withEmptyAlt: number; withoutDimensions: number; lazyLoaded: number; lazyAboveFold: number; clickableWithoutAlt: number; decorativeCount: number; largeImages: number; modernFormats: number; srcsetCount: number; brokenCount?: number; brokenList?: { src: string; alt: string }[]; withoutAltList?: { src: string; context: string }[]; withoutDimensionsList?: { src: string; alt: string }[]; emptyAltList?: { src: string; context: string }[]; imageSizeAnalysis?: { checked: number; largeCount: number; oldFormatCount: number; largeList: { src: string; size: string; type: string | null }[]; oldFormatList: { src: string; type: string | null }[]; }; };
  schema: { count: number; types: string[]; valid: number; invalid: number; details: SchemaItem[]; missingContext: number; hasWebSiteSearch: boolean; hasBreadcrumb: boolean; hasOrganization: boolean; hasFAQ: boolean; hasHowTo: boolean; };
  social: { og: { title: string | null; description: string | null; image: string | null; url: string | null; type: string | null; siteName: string | null; locale: string | null }; twitter: { card: string | null; site: string | null; creator: string | null; title: string | null; description: string | null; image: string | null }; isComplete: boolean; hasArticleTags: boolean; };
  accessibility: { buttonsWithoutLabel: number; inputsWithoutLabel: number; linksWithoutText: number; iframesWithoutTitle: number; skippedHeadings: string[]; hasSkipLink: boolean; hasLangAttribute: boolean; clickableImagesWithoutAlt: number; positiveTabindex: number; hasMainLandmark: boolean; hasNavLandmark: boolean; hasFocusVisible: boolean; colorContrastIssues: number; contrastDetails?: { lowContrastElements: { element: string; text: string; colors: string; ratio: string; section?: string }[]; passedWCAG_AA: boolean; passedWCAG_AAA: boolean; score: number; sectionIssues?: { section: string; count: number }[] }; aria: AriaData; tablesWithoutHeaders: number; autoplayMedia: number; };
  dom: DOMData;
  performance: { totalScripts: number; totalStylesheets: number; renderBlockingScripts: number; renderBlockingStyles: number; asyncScripts: number; deferScripts: number; moduleScripts: number; inlineScripts: number; inlineStyles: number; preloads: number; preloadsWithoutAs: number; preconnects: number; prefetches: number; dnsPrefetches: number; fontsWithoutDisplay: number; webFonts: number; criticalCssInlined: boolean; hasServiceWorker: boolean; htmlSize: number; estimatedWeight: string; };
  security: { isHttps: boolean; mixedContentCount: number; mixedContentUrls: string[]; protocolRelativeCount: number; unsafeExternalLinks: number; hasCSP: boolean; hasXFrameOptions: boolean; hasXContentTypeOptions: boolean; hasReferrerPolicy: boolean; hasCORS: boolean; formWithoutAction: number; passwordFieldWithoutAutocomplete: number; ssl?: { valid: boolean; issuer?: string; validFrom?: string; validTo?: string; daysUntilExpiry?: number; error?: string }; securityHeaders?: { headers: Record<string, string | null>; score: number; issues: string[] }; };
  platform: { cms: string[]; frameworks: string[]; analytics: string[]; advertising: string[]; renderMethod: string; isCSR: boolean; isPWA: boolean; hasAMP: boolean; };
  trustSignals: { hasAboutPage: boolean; hasContactPage: boolean; hasPrivacyPage: boolean; hasTermsPage: boolean; hasCookiePolicy: boolean; hasAuthor: boolean; hasPublishDate: boolean; hasModifiedDate: boolean; hasCopyright: boolean; hasAddress: boolean; hasPhone: boolean; hasEmail: boolean; socialLinksCount: number; socialPlatforms: string[]; hasSSLBadge: boolean; hasPaymentBadges: boolean; hasReviews: boolean; hasCertifications: boolean; };
  mobile: { hasViewport: boolean; viewportContent: string | null; hasWidthDeviceWidth: boolean; hasInitialScale: boolean; hasUserScalable: boolean; smallTapTargets: number; tapTargetsList: { element: string; size: string }[]; smallTextElements: number; usesRelativeFontSizes: boolean; hasMediaQueries: boolean; mediaQueryCount: number; hasFlexbox: boolean; hasGrid: boolean; horizontalScrollRisk: boolean; fixedWidthElements: number; hasThemeColor: boolean; hasAppleMobileWebAppCapable: boolean; hasAppleTouchIcon: boolean; hasManifest: boolean; responsiveImagesCount: number; totalImages: number; score: number; issues: string[]; };
  externalResources: { cssFiles: { url: string; isThirdParty: boolean }[]; cssCount: number; jsFiles: { url: string; isThirdParty: boolean; async: boolean; defer: boolean; module: boolean }[]; jsCount: number; fontFiles: { url: string; format: string | null }[]; fontCount: number; googleFonts: string[]; thirdPartyDomains: string[]; thirdPartyCount: number; suggestedPreconnects: string[]; };
  issues: AuditIssue[];
  passed: string[];
}

// Icons
const Icons = {
  Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Globe: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>,
  Code: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  Download: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Alert: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Check: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ChevronDown: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  ChevronUp: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>,
  Loader: () => <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Link: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  Image: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Share: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
  Shield: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Zap: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Lock: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  Languages: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>,
  FileText: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Eye: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Brain: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
  Accessibility: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  DOM: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
  Chart: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Smartphone: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
  Server: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>,
};

// Chart Components
const DonutChart = ({ value, size = 120, strokeWidth = 10, color }: { value: number; size?: number; strokeWidth?: number; color: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
    </svg>
  );
};

const BarChart = ({ data, maxValue }: { data: { label: string; value: number; color: string }[]; maxValue?: number }) => {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-20 text-sm text-gray-600 truncate">{item.label}</div>
          <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }} />
          </div>
          <div className="w-10 text-sm font-medium text-right">{item.value}</div>
        </div>
      ))}
    </div>
  );
};

const PieChart = ({ data, size = 120 }: { data: { label: string; value: number; color: string }[]; size?: number }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  let currentAngle = 0;
  const segments = data.map(d => {
    const angle = (d.value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    return { ...d, startAngle, angle };
  });

  const describeArc = (startAngle: number, endAngle: number, radius: number) => {
    const start = { x: size / 2 + radius * Math.cos((Math.PI * startAngle) / 180), y: size / 2 + radius * Math.sin((Math.PI * startAngle) / 180) };
    const end = { x: size / 2 + radius * Math.cos((Math.PI * endAngle) / 180), y: size / 2 + radius * Math.sin((Math.PI * endAngle) / 180) };
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${size / 2} ${size / 2} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
  };

  return (
    <svg width={size} height={size}>
      {segments.map((seg, i) => seg.value > 0 && (
        <path key={i} d={describeArc(seg.startAngle - 90, seg.startAngle + seg.angle - 90, size / 2 - 5)} fill={seg.color} className="transition-all duration-500" />
      ))}
    </svg>
  );
};

const HorizontalBar = ({ value, max, color, label }: { value: number; max: number; color: string; label: string }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-sm"><span className="text-gray-600">{label}</span><span className="font-medium">{value}</span></div>
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min((value / max) * 100, 100)}%`, backgroundColor: color }} />
    </div>
  </div>
);

export default function SEOChecker() {
  const [url, setUrl] = useState('');
  const [htmlInput, setHtmlInput] = useState('');
  const [inputMode, setInputMode] = useState<'url' | 'html'>('url');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<AuditResult | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isDragging, setIsDragging] = useState(false);

  // All sections to open by default
  const allSections = ['overview', 'issues', 'passed', 'technical', 'content', 'headings-tree', 'all-links', 'international', 'links', 'images', 'schema', 'social', 'platform', 'accessibility', 'dom', 'performance', 'ai', 'trust', 'mobile', 'external-resources'];

  const handleAnalyze = async () => {
    setError('');
    setResults(null);
    setLoading(true);
    try {
      const res = await fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inputMode === 'url' ? { url } : { html: htmlInput, url }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'აუდიტი ვერ შესრულდა');
      setResults(data);
      // Open all sections by default
      setExpanded(allSections.reduce((acc, s) => ({ ...acc, [s]: true }), {}));
    } catch (e) { setError(e instanceof Error ? e.message : 'შეცდომა მოხდა'); }
    finally { setLoading(false); }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.type === 'text/html' || file.name.endsWith('.html'))) {
      const reader = new FileReader();
      reader.onload = (ev) => { setHtmlInput(ev.target?.result as string); setInputMode('html'); };
      reader.readAsText(file);
    }
  }, []);

  const exportData = (format: 'json' | 'csv') => {
    if (!results) return;
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `seo-audit-${new Date().toISOString().split('T')[0]}.json`; a.click();
    } else {
      const rows = [['კატეგორია', 'პრობლემა', 'სერიოზულობა', 'ადგილი', 'გამოსწორება']];
      results.issues.forEach(i => rows.push([i.category, i.issueGe, i.severity, i.location, i.fixGe]));
      const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `seo-audit-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    }
  };

  const getScoreColor = (s: number) => s >= 90 ? '#10b981' : s >= 70 ? '#f59e0b' : s >= 50 ? '#f97316' : '#ef4444';
  const getSeverityStyle = (sev: string) => ({ critical: 'bg-red-100 text-red-800 border-red-200', high: 'bg-orange-100 text-orange-800 border-orange-200', medium: 'bg-yellow-100 text-yellow-800 border-yellow-200', low: 'bg-blue-100 text-blue-800 border-blue-200' }[sev] || 'bg-gray-100');
  const getSeverityLabel = (sev: string) => ({ critical: 'კრიტიკული', high: 'მაღალი', medium: 'საშუალო', low: 'დაბალი' }[sev] || sev);

  const Section = ({ title, icon: Icon, id, children, badge, defaultOpen = true }: { title: string; icon: React.FC; id: string; children: React.ReactNode; badge?: React.ReactNode; defaultOpen?: boolean }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <button onClick={() => setExpanded(s => ({ ...s, [id]: !s[id] }))} className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50">
        <div className="flex items-center gap-3"><Icon /><span className="font-semibold text-gray-800">{title}</span>{badge}</div>
        {expanded[id] ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
      </button>
      {expanded[id] && <div className="px-5 pb-5 border-t border-gray-100">{children}</div>}
    </div>
  );

  const CheckBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className={`flex items-center gap-1.5 text-sm ${ok ? 'text-green-700' : 'text-red-700'}`}>
      {ok ? <Icons.Check /> : <Icons.Alert />} {label}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold">SEO აუდიტი</h1>
          <p className="text-emerald-100 mt-1">ვებგვერდის SEO ანალიზი • {results ? `${results.summary.totalChecks} შემოწმება შესრულდა` : 'სრული SEO ანალიზი'}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Input */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex gap-3 mb-5">
            <button onClick={() => { setInputMode('url'); setResults(null); setError(''); }} className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 ${inputMode === 'url' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Icons.Globe /> URL-ით</button>
            <button onClick={() => { setInputMode('html'); setResults(null); setError(''); }} className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 ${inputMode === 'html' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><Icons.Code /> HTML ჩასმა</button>
          </div>

          {inputMode === 'url' ? (
            <div>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Globe /></div>
                  <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 outline-none" onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()} />
                </div>
                <button onClick={handleAnalyze} disabled={loading || !url} className="px-8 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2">{loading ? <Icons.Loader /> : <Icons.Search />} ანალიზი</button>
              </div>
              <p className="text-sm text-gray-500 mt-3">💡 თუ საიტი დაცულია Cloudflare-ით, გამოიყენეთ &quot;HTML ჩასმა&quot; რეჟიმი</p>
            </div>
          ) : (
            <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
              <div className="flex gap-3 mb-3">
                <div className="flex-1 relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Globe /></div>
                  <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (არასავალდებულო)" className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 outline-none" />
                </div>
              </div>
              <textarea value={htmlInput} onChange={(e) => setHtmlInput(e.target.value)} placeholder={`ჩასვით HTML კოდი აქ...\n\nროგორ მივიღოთ HTML:\n1. გახსენით გვერდი ბრაუზერში\n2. დააჭირეთ Ctrl+U (Windows) ან Cmd+Option+U (Mac)\n3. აირჩიეთ ყველა (Ctrl+A) და დააკოპირეთ (Ctrl+C)\n4. ჩასვით აქ\n\n💡 ან გადმოიტანეთ HTML ფაილი აქ`} className={`w-full h-48 px-4 py-3 border-2 rounded-xl font-mono text-sm resize-none ${isDragging ? 'border-emerald-500 bg-emerald-50 border-dashed' : 'border-gray-200'}`} />
              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-gray-500">{htmlInput ? `${htmlInput.length.toLocaleString()} სიმბოლო` : ''}</span>
                <button onClick={handleAnalyze} disabled={loading || !htmlInput} className="px-8 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2">{loading ? <Icons.Loader /> : <Icons.Search />} ანალიზი</button>
              </div>
            </div>
          )}

          {error && <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"><span className="text-red-600"><Icons.Alert /></span><span className="text-red-700">{error}</span></div>}
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-6">
            {/* Score Overview with Charts */}
            <Section title="მთავარი მიმოხილვა" icon={Icons.Chart} id="overview">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
                {/* Score Donut */}
                <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                  <div className="relative">
                    <DonutChart value={results.score} size={140} strokeWidth={12} color={getScoreColor(results.score)} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-4xl font-bold" style={{ color: getScoreColor(results.score) }}>{results.score}</div>
                        <div className="text-gray-500 text-sm">/ 100</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <div className="font-semibold text-gray-800">{results.score >= 90 ? 'შესანიშნავი!' : results.score >= 70 ? 'კარგი' : results.score >= 50 ? 'საშუალო' : 'საჭიროებს გაუმჯობესებას'}</div>
                    <div className="text-sm text-gray-500 mt-1 truncate max-w-xs">{results.url}</div>
                  </div>
                </div>

                {/* Issues Bar Chart */}
                <div className="p-6 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-800 mb-4">პრობლემები სერიოზულობით</h3>
                  <BarChart data={[
                    { label: 'კრიტიკული', value: results.summary.criticalIssues, color: '#ef4444' },
                    { label: 'მაღალი', value: results.summary.highIssues, color: '#f97316' },
                    { label: 'საშუალო', value: results.summary.mediumIssues, color: '#eab308' },
                    { label: 'დაბალი', value: results.summary.lowIssues, color: '#3b82f6' },
                  ]} />
                </div>

                {/* Links Pie Chart */}
                <div className="p-6 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-800 mb-4">ბმულების განაწილება</h3>
                  <div className="flex items-center justify-center gap-4">
                    <PieChart data={[
                      { label: 'შიდა', value: results.links.internal, color: '#10b981' },
                      { label: 'გარე', value: results.links.external, color: '#8b5cf6' },
                      { label: 'გატეხილი', value: results.links.broken, color: '#ef4444' },
                    ]} size={100} />
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span>შიდა: {results.links.internal}</span></div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500" /><span>გარე: {results.links.external}</span></div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span>გატეხილი: {results.links.broken}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* More Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* Images Breakdown */}
                <div className="p-6 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-800 mb-4">სურათების ანალიზი</h3>
                  <BarChart data={[
                    { label: 'სულ', value: results.images.total, color: '#6366f1' },
                    { label: 'alt-ის გარეშე', value: results.images.withoutAlt, color: '#ef4444' },
                    { label: 'ზომის გარეშე', value: results.images.withoutDimensions, color: '#f97316' },
                    { label: 'Lazy Load', value: results.images.lazyLoaded, color: '#10b981' },
                    { label: 'WebP/AVIF', value: results.images.modernFormats || 0, color: '#06b6d4' },
                  ]} />
                </div>

                {/* Content Composition */}
                <div className="p-6 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-800 mb-4">კონტენტის შემადგენლობა</h3>
                  <div className="space-y-3">
                    <HorizontalBar value={results.content.headings.h1.length + results.content.headings.h2.length + results.content.headings.h3.length} max={20} color="#ef4444" label={`სათაურები: ${results.content.headings.h1.length + results.content.headings.h2.length + results.content.headings.h3.length}`} />
                    <HorizontalBar value={results.content.paragraphCount || 0} max={50} color="#3b82f6" label={`პარაგრაფები: ${results.content.paragraphCount || 0}`} />
                    <HorizontalBar value={results.links.total} max={100} color="#8b5cf6" label={`ბმულები: ${results.links.total}`} />
                    <HorizontalBar value={results.images.total} max={50} color="#10b981" label={`სურათები: ${results.images.total}`} />
                    <HorizontalBar value={results.schema.count} max={10} color="#f59e0b" label={`Schema: ${results.schema.count}`} />
                  </div>
                </div>

                {/* SEO Health Indicators */}
                <div className="p-6 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-800 mb-4">SEO ჯანმრთელობა</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-lg text-center ${results.technical.title.isOptimal ? 'bg-green-100' : 'bg-yellow-100'}`}>
                      <div className={`text-lg font-bold ${results.technical.title.isOptimal ? 'text-green-700' : 'text-yellow-700'}`}>{results.technical.title.isOptimal ? '✓' : '⚠'}</div>
                      <div className="text-xs text-gray-600">Title</div>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${results.technical.metaDesc.isOptimal ? 'bg-green-100' : 'bg-yellow-100'}`}>
                      <div className={`text-lg font-bold ${results.technical.metaDesc.isOptimal ? 'text-green-700' : 'text-yellow-700'}`}>{results.technical.metaDesc.isOptimal ? '✓' : '⚠'}</div>
                      <div className="text-xs text-gray-600">Meta Desc</div>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${results.content.headings.h1.length === 1 ? 'bg-green-100' : 'bg-red-100'}`}>
                      <div className={`text-lg font-bold ${results.content.headings.h1.length === 1 ? 'text-green-700' : 'text-red-700'}`}>{results.content.headings.h1.length === 1 ? '✓' : results.content.headings.h1.length}</div>
                      <div className="text-xs text-gray-600">H1</div>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${results.security.isHttps ? 'bg-green-100' : 'bg-red-100'}`}>
                      <div className={`text-lg font-bold ${results.security.isHttps ? 'text-green-700' : 'text-red-700'}`}>{results.security.isHttps ? '✓' : '✗'}</div>
                      <div className="text-xs text-gray-600">HTTPS</div>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${results.images.withoutAlt === 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                      <div className={`text-lg font-bold ${results.images.withoutAlt === 0 ? 'text-green-700' : 'text-red-700'}`}>{results.images.withoutAlt === 0 ? '✓' : results.images.withoutAlt}</div>
                      <div className="text-xs text-gray-600">Alt Tags</div>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${results.schema.count > 0 ? 'bg-green-100' : 'bg-yellow-100'}`}>
                      <div className={`text-lg font-bold ${results.schema.count > 0 ? 'text-green-700' : 'text-yellow-700'}`}>{results.schema.count > 0 ? '✓' : '⚠'}</div>
                      <div className="text-xs text-gray-600">Schema</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
                <div className="p-3 bg-slate-50 rounded-lg text-center"><div className="text-2xl font-bold text-slate-700">{results.summary.totalChecks}</div><div className="text-xs text-slate-600">შემოწმება</div></div>
                <div className="p-3 bg-green-50 rounded-lg text-center"><div className="text-2xl font-bold text-green-700">{results.summary.passedChecks}</div><div className="text-xs text-green-600">წარმატებული</div></div>
                <div className="p-3 bg-red-50 rounded-lg text-center"><div className="text-2xl font-bold text-red-700">{results.issues.length}</div><div className="text-xs text-red-600">პრობლემა</div></div>
                <div className="p-3 bg-blue-50 rounded-lg text-center"><div className="text-2xl font-bold text-blue-700">{results.content.wordCount}</div><div className="text-xs text-blue-600">სიტყვა</div></div>
                <div className="p-3 bg-purple-50 rounded-lg text-center"><div className="text-2xl font-bold text-purple-700">{results.images.total}</div><div className="text-xs text-purple-600">სურათი</div></div>
                <div className="p-3 bg-amber-50 rounded-lg text-center"><div className="text-2xl font-bold text-amber-700">{results.schema.count}</div><div className="text-xs text-amber-600">Schema</div></div>
                <div className="p-3 bg-teal-50 rounded-lg text-center"><div className="text-2xl font-bold text-teal-700">{(results.content.readability?.fleschScore || 0).toFixed(1)}</div><div className="text-xs text-teal-600">Flesch Score</div></div>
              </div>

              {/* Export Buttons */}
              <div className="flex gap-2 mt-6">
                <button onClick={() => exportData('json')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-sm"><Icons.Download /> JSON ექსპორტი</button>
                <button onClick={() => exportData('csv')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-sm"><Icons.Download /> CSV ექსპორტი</button>
              </div>
            </Section>

            {/* Issues */}
            <Section title="ნაპოვნი პრობლემები" icon={Icons.Alert} id="issues" badge={<span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-sm">{results.issues.length}</span>}>
              <div className="space-y-3 mt-4">
                {[...results.issues].sort((a, b) => {
                  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
                  return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
                }).map((issue, i) => (
                  <div key={i} className={`p-4 rounded-lg border ${getSeverityStyle(issue.severity)}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-medium">{issue.issueGe}</div>
                        <div className="text-sm mt-1 opacity-80"><code className="bg-white/50 px-1 rounded">{issue.location}</code></div>
                        {issue.current && <div className="text-xs mt-1 opacity-70 truncate max-w-md">მიმდინარე: {issue.current}</div>}
                        {issue.details && <div className="text-xs mt-1 opacity-70">{issue.details}</div>}

                        {/* Show broken links list */}
                        {issue.id === 'broken-links' && results.links.brokenList && results.links.brokenList.length > 0 && (
                          <div className="mt-2 p-2 bg-white/30 rounded text-xs space-y-1">
                            <div className="font-medium">გატეხილი ბმულები:</div>
                            {results.links.brokenList.map((link: {href: string; text: string}, j: number) => (
                              <div key={j} className="flex gap-2 items-center">
                                <span className="text-red-600">•</span>
                                <code className="bg-white/50 px-1 rounded truncate max-w-xs">{link.href}</code>
                                {link.text && <span className="opacity-60 truncate">({link.text})</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Show generic anchors list */}
                        {issue.id === 'generic-anchors' && results.links.genericAnchorsList && results.links.genericAnchorsList.length > 0 && (
                          <div className="mt-2 p-2 bg-white/30 rounded text-xs space-y-1">
                            <div className="font-medium">ზოგადი ანკორები:</div>
                            {results.links.genericAnchorsList.slice(0, 5).map((link: {text: string; href: string}, j: number) => (
                              <div key={j} className="flex gap-2 items-center">
                                <span className="text-yellow-600">•</span>
                                <code className="bg-white/50 px-1 rounded">&quot;{link.text}&quot;</code>
                                <span className="opacity-60 truncate max-w-xs">→ {link.href}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Show broken images list */}
                        {issue.id === 'broken-images' && results.images.brokenList && results.images.brokenList.length > 0 && (
                          <div className="mt-2 p-2 bg-white/30 rounded text-xs space-y-1">
                            <div className="font-medium">გატეხილი სურათები:</div>
                            {results.images.brokenList.map((img: {src: string; alt: string}, j: number) => (
                              <div key={j} className="flex gap-2 items-center">
                                <span className="text-red-600">•</span>
                                <code className="bg-white/50 px-1 rounded truncate max-w-xs">{img.src}</code>
                                {img.alt && <span className="opacity-60 truncate">({img.alt})</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Show redirect links */}
                        {issue.id === 'redirect-links' && results.links.redirectList && results.links.redirectList.length > 0 && (
                          <div className="mt-2 p-2 bg-white/30 rounded text-xs space-y-1">
                            <div className="font-medium">გადამისამართებული ბმულები:</div>
                            {results.links.redirectList.map((link: {href: string; text: string; status: number; location: string}, j: number) => (
                              <div key={j} className="flex flex-col gap-0.5 p-1 bg-white/20 rounded">
                                <div className="flex gap-2 items-center">
                                  <span className="text-yellow-600">•</span>
                                  <span className="text-orange-600 font-medium">HTTP {link.status}</span>
                                </div>
                                {link.text && <div className="pl-4 text-gray-700">ტექსტი: &quot;{link.text.substring(0, 50)}{link.text.length > 50 ? '...' : ''}&quot;</div>}
                                <div className="pl-4"><code className="bg-white/50 px-1 rounded break-all">{link.href}</code></div>
                                <div className="pl-4 text-green-700">→ {link.location}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Show broken external links */}
                        {issue.id === 'broken-external-links' && results.links.brokenExternalList && results.links.brokenExternalList.length > 0 && (
                          <div className="mt-2 p-2 bg-white/30 rounded text-xs space-y-1">
                            <div className="font-medium">გატეხილი გარე ბმულები:</div>
                            {results.links.brokenExternalList.map((link: {href: string; text: string; status: number; error?: string}, j: number) => (
                              <div key={j} className="flex flex-col gap-0.5 p-1 bg-white/20 rounded">
                                <div className="flex gap-2 items-center">
                                  <span className="text-red-600">•</span>
                                  <span className="text-red-600 font-medium">{link.status ? `HTTP ${link.status}` : link.error}</span>
                                </div>
                                {link.text && <div className="pl-4 text-gray-700">ტექსტი: &quot;{link.text.substring(0, 50)}{link.text.length > 50 ? '...' : ''}&quot;</div>}
                                <div className="pl-4"><code className="bg-white/50 px-1 rounded break-all">{link.href}</code></div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Show large images */}
                        {issue.id === 'large-images' && results.images.imageSizeAnalysis?.largeList && results.images.imageSizeAnalysis.largeList.length > 0 && (
                          <div className="mt-2 p-2 bg-white/30 rounded text-xs space-y-1">
                            <div className="font-medium">დიდი ზომის სურათები:</div>
                            {results.images.imageSizeAnalysis.largeList.slice(0, 5).map((img: {src: string; size: string; type: string | null}, j: number) => (
                              <div key={j} className="flex gap-2 items-center">
                                <span className="text-yellow-600">•</span>
                                <code className="bg-white/50 px-1 rounded truncate max-w-xs">{img.src.split('/').pop()}</code>
                                <span className="font-medium">{img.size}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Show images without alt */}
                        {issue.id === 'img-no-alt' && results.images.withoutAltList && results.images.withoutAltList.length > 0 && (
                          <div className="mt-2 p-2 bg-white/30 rounded text-xs space-y-1">
                            <div className="font-medium">სურათები alt ტექსტის გარეშე:</div>
                            {results.images.withoutAltList.map((img: {src: string; context: string}, j: number) => (
                              <div key={j} className="flex flex-col gap-0.5 p-1 bg-white/20 rounded">
                                <div className="flex gap-2 items-center">
                                  <span className="text-red-600">•</span>
                                  <code className="bg-white/50 px-1 rounded break-all text-xs">{img.src}</code>
                                </div>
                                {img.context && <div className="pl-4 text-gray-600 text-xs">{img.context}</div>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Show images without dimensions */}
                        {issue.id === 'img-no-dim' && results.images.withoutDimensionsList && results.images.withoutDimensionsList.length > 0 && (
                          <div className="mt-2 p-2 bg-white/30 rounded text-xs space-y-1">
                            <div className="font-medium">სურათები ზომების (width/height) გარეშე:</div>
                            {results.images.withoutDimensionsList.map((img: {src: string; alt: string}, j: number) => (
                              <div key={j} className="flex flex-col gap-0.5 p-1 bg-white/20 rounded">
                                <div className="flex gap-2 items-center">
                                  <span className="text-yellow-600">•</span>
                                  <code className="bg-white/50 px-1 rounded break-all text-xs">{img.src}</code>
                                </div>
                                <div className="pl-4 text-gray-600 text-xs">alt: &quot;{img.alt}&quot;</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Show mixed content URLs */}
                        {issue.id === 'mixed-content' && results.security.mixedContentUrls && results.security.mixedContentUrls.length > 0 && (
                          <div className="mt-2 p-2 bg-white/30 rounded text-xs space-y-1">
                            <div className="font-medium">HTTP რესურსები HTTPS გვერდზე:</div>
                            {results.security.mixedContentUrls.map((url: string, j: number) => (
                              <div key={j} className="flex gap-2 items-center">
                                <span className="text-red-600">•</span>
                                <code className="bg-white/50 px-1 rounded truncate max-w-md">{url}</code>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Show duplicate IDs */}
                        {issue.id === 'duplicate-ids' && results.dom.duplicateIds && results.dom.duplicateIds.length > 0 && (
                          <div className="mt-2 p-2 bg-white/30 rounded text-xs">
                            <span className="font-medium">დუბლირებული ID-ები: </span>
                            {results.dom.duplicateIds.map((id: string, j: number) => (
                              <code key={j} className="bg-white/50 px-1 rounded mx-0.5">#{id}</code>
                            ))}
                          </div>
                        )}

                        {/* Show deprecated elements */}
                        {issue.id === 'deprecated' && results.dom.deprecatedElements && results.dom.deprecatedElements.length > 0 && (
                          <div className="mt-2 p-2 bg-white/30 rounded text-xs">
                            <span className="font-medium">მოძველებული ტეგები: </span>
                            {results.dom.deprecatedElements.map((el: string, j: number) => (
                              <code key={j} className="bg-white/50 px-1 rounded mx-0.5">&lt;{el}&gt;</code>
                            ))}
                          </div>
                        )}

                        {/* Show skipped headings */}
                        {issue.id === 'skipped-headings' && results.accessibility.skippedHeadings && results.accessibility.skippedHeadings.length > 0 && (
                          <div className="mt-2 p-2 bg-white/30 rounded text-xs">
                            <span className="font-medium">გამოტოვებული: </span>
                            {results.accessibility.skippedHeadings.map((skip: string, j: number) => (
                              <code key={j} className="bg-white/50 px-1 rounded mx-0.5">{skip}</code>
                            ))}
                          </div>
                        )}

                        {/* Show missing landmarks */}
                        {issue.id === 'missing-landmarks' && results.accessibility.aria?.missingLandmarks && (
                          <div className="mt-2 p-2 bg-white/30 rounded text-xs">
                            <span className="font-medium">აკლია: </span>
                            {results.accessibility.aria.missingLandmarks.map((lm: string, j: number) => (
                              <code key={j} className="bg-white/50 px-1 rounded mx-0.5">{lm}</code>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded bg-white/50 whitespace-nowrap">{getSeverityLabel(issue.severity)}</span>
                    </div>
                    <div className="text-sm mt-2 opacity-90"><strong>გამოსწორება:</strong> {issue.fixGe}</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Passed */}
            <Section title="წარმატებული შემოწმებები" icon={Icons.Check} id="passed" badge={<span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-sm">{results.passed.length}</span>}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
                {results.passed.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg text-sm"><Icons.Check /> {p}</div>
                ))}
              </div>
            </Section>

            {/* Content & Readability */}
            <Section title="კონტენტი და წაკითხვადობა" icon={Icons.FileText} id="content">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                {/* Readability Gauge */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h4 className="font-medium text-gray-700 mb-4">Flesch Reading Score</h4>
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <DonutChart value={results.content.readability?.fleschScore || 0} size={100} strokeWidth={10} color={results.content.readability?.fleschScore >= 60 ? '#10b981' : results.content.readability?.fleschScore >= 30 ? '#f59e0b' : '#ef4444'} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold">{(results.content.readability?.fleschScore || 0).toFixed(1)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{results.content.readability?.fleschGrade || '—'}</div>
                      <div className="text-sm text-gray-500 mt-1">საშუალო წინ. სიგრძე: {results.content.readability?.avgSentenceLength || 0}</div>
                      <div className="text-sm text-gray-500">რთული სიტყვები: {results.content.readability?.complexWordPercentage || 0}%</div>
                    </div>
                  </div>
                </div>

                {/* Word Stats */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h4 className="font-medium text-gray-700 mb-4">კონტენტის სტატისტიკა</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div><div className="text-2xl font-bold text-gray-800">{results.content.wordCount.toLocaleString()}</div><div className="text-sm text-gray-500">სიტყვა</div></div>
                    <div><div className="text-2xl font-bold text-gray-800">{results.content.sentenceCount || 0}</div><div className="text-sm text-gray-500">წინადადება</div></div>
                    <div><div className="text-2xl font-bold text-gray-800">{results.content.paragraphCount || 0}</div><div className="text-sm text-gray-500">პარაგრაფი</div></div>
                    <div><div className="text-2xl font-bold text-gray-800">~{results.content.readingTime}</div><div className="text-sm text-gray-500">წუთი კითხვა</div></div>
                  </div>
                </div>

                {/* Keyword Density */}
                {results.content.keywordDensity && results.content.keywordDensity.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-xl lg:col-span-2">
                    <h4 className="font-medium text-gray-700 mb-4">საკვანძო სიტყვების სიხშირე (Top 10)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {results.content.keywordDensity.slice(0, 10).map((kw, i) => (
                        <div key={i} className="bg-white p-3 rounded-lg text-center">
                          <div className="font-medium text-gray-800 truncate">{kw.word}</div>
                          <div className="text-sm text-gray-500">{kw.count}x ({kw.percentage}%)</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Headings */}
                <div className="p-4 bg-gray-50 rounded-xl lg:col-span-2">
                  <h4 className="font-medium text-gray-700 mb-4">სათაურების სტრუქტურა</h4>
                  <BarChart data={[
                    { label: 'H1', value: results.content.headings.h1.length, color: '#ef4444' },
                    { label: 'H2', value: results.content.headings.h2.length, color: '#f97316' },
                    { label: 'H3', value: results.content.headings.h3.length, color: '#eab308' },
                    { label: 'H4', value: results.content.headings.h4.length, color: '#22c55e' },
                    { label: 'H5', value: results.content.headings.h5.length, color: '#3b82f6' },
                    { label: 'H6', value: results.content.headings.h6.length, color: '#8b5cf6' },
                  ]} />
                </div>
              </div>
            </Section>

            {/* Headings Tree */}
            <Section title="სათაურების ხე (Heading Tree)" icon={Icons.FileText} id="headings-tree">
              <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                <div className="space-y-1 font-mono text-sm">
                  {results.content.headings.h1.map((h, i) => (
                    <div key={`h1-${i}`} className="flex items-center gap-2">
                      <span className="text-red-600 font-bold w-8">H1</span>
                      <span className="text-gray-800">{h}</span>
                    </div>
                  ))}
                  {results.content.headings.h2.map((h, i) => (
                    <div key={`h2-${i}`} className="flex items-center gap-2 pl-4">
                      <span className="text-orange-600 font-bold w-8">H2</span>
                      <span className="text-gray-700">{h}</span>
                    </div>
                  ))}
                  {results.content.headings.h3.map((h, i) => (
                    <div key={`h3-${i}`} className="flex items-center gap-2 pl-8">
                      <span className="text-yellow-600 font-bold w-8">H3</span>
                      <span className="text-gray-600">{h}</span>
                    </div>
                  ))}
                  {results.content.headings.h4.map((h, i) => (
                    <div key={`h4-${i}`} className="flex items-center gap-2 pl-12">
                      <span className="text-green-600 font-bold w-8">H4</span>
                      <span className="text-gray-600">{h}</span>
                    </div>
                  ))}
                  {results.content.headings.h5.map((h, i) => (
                    <div key={`h5-${i}`} className="flex items-center gap-2 pl-16">
                      <span className="text-blue-600 font-bold w-8">H5</span>
                      <span className="text-gray-500">{h}</span>
                    </div>
                  ))}
                  {results.content.headings.h6.map((h, i) => (
                    <div key={`h6-${i}`} className="flex items-center gap-2 pl-20">
                      <span className="text-purple-600 font-bold w-8">H6</span>
                      <span className="text-gray-500">{h}</span>
                    </div>
                  ))}
                  {results.content.headings.h1.length === 0 && results.content.headings.h2.length === 0 && (
                    <div className="text-gray-400 italic">სათაურები არ მოიძებნა</div>
                  )}
                </div>
              </div>
            </Section>

            {/* All Links - Grouped */}
            <Section title="ყველა ბმული (დაჯგუფებული)" icon={Icons.Link} id="all-links" badge={<span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-sm">{results.links.total} ბმული</span>}>
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Internal Links */}
                <div className="p-4 bg-green-50 rounded-xl">
                  <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    შიდა ბმულები ({results.links.internal})
                  </h4>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {results.links.internalUrls && results.links.internalUrls.length > 0 ? (
                      results.links.internalUrls.slice(0, 30).map((link: {href: string; text: string}, i: number) => (
                        <div key={i} className="p-2 bg-white rounded text-sm">
                          <div className="text-green-700 font-medium truncate">{link.text || '(ანკორი არ აქვს)'}</div>
                          <code className="text-xs text-gray-500 break-all">{link.href}</code>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 text-sm italic">შიდა ბმულები არ მოიძებნა</div>
                    )}
                    {results.links.internalUrls && results.links.internalUrls.length > 30 && (
                      <div className="text-green-600 text-sm">... და კიდევ {results.links.internalUrls.length - 30} ბმული</div>
                    )}
                  </div>
                </div>

                {/* External Links */}
                <div className="p-4 bg-purple-50 rounded-xl">
                  <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                    გარე ბმულები ({results.links.external})
                  </h4>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {results.links.externalUrls && results.links.externalUrls.length > 0 ? (
                      results.links.externalUrls.slice(0, 30).map((link: {href: string; text: string}, i: number) => (
                        <div key={i} className="p-2 bg-white rounded text-sm">
                          <div className="text-purple-700 font-medium truncate">{link.text || '(ანკორი არ აქვს)'}</div>
                          <code className="text-xs text-gray-500 break-all">{link.href}</code>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 text-sm italic">გარე ბმულები არ მოიძებნა</div>
                    )}
                    {results.links.externalUrls && results.links.externalUrls.length > 30 && (
                      <div className="text-purple-600 text-sm">... და კიდევ {results.links.externalUrls.length - 30} ბმული</div>
                    )}
                  </div>
                </div>

                {/* Redirect Links */}
                {results.links.redirectList && results.links.redirectList.length > 0 && (
                  <div className="p-4 bg-yellow-50 rounded-xl">
                    <h4 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                      გადამისამართებული ({results.links.redirectLinks || 0})
                    </h4>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {results.links.redirectList.map((link: {href: string; text: string; status: number; location: string}, i: number) => (
                        <div key={i} className="p-2 bg-white rounded text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-600 font-medium">HTTP {link.status}</span>
                            <span className="text-gray-700">{link.text || '(ანკორი არ აქვს)'}</span>
                          </div>
                          <code className="text-xs text-gray-500 break-all">{link.href}</code>
                          <div className="text-xs text-green-600 mt-1">→ {link.location}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Broken External Links */}
                {results.links.brokenExternalList && results.links.brokenExternalList.length > 0 && (
                  <div className="p-4 bg-red-50 rounded-xl">
                    <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      გატეხილი გარე ბმულები ({results.links.brokenExternalLinks || 0})
                    </h4>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {results.links.brokenExternalList.map((link: {href: string; text: string; status: number; error?: string}, i: number) => (
                        <div key={i} className="p-2 bg-white rounded text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-red-600 font-medium">{link.status ? `HTTP ${link.status}` : link.error}</span>
                            <span className="text-gray-700 truncate">{link.text || '(ანკორი არ აქვს)'}</span>
                          </div>
                          <code className="text-xs text-gray-500 break-all">{link.href}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Links Distribution Visualization */}
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-700 mb-4">ბმულების განაწილება</h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-6 rounded-full overflow-hidden flex">
                      <div className="bg-green-500 transition-all" style={{width: `${results.links.total > 0 ? (results.links.internal / results.links.total) * 100 : 0}%`}}></div>
                      <div className="bg-purple-500 transition-all" style={{width: `${results.links.total > 0 ? (results.links.external / results.links.total) * 100 : 0}%`}}></div>
                      <div className="bg-red-500 transition-all" style={{width: `${results.links.total > 0 ? (results.links.broken / results.links.total) * 100 : 0}%`}}></div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-6 mt-3 text-sm">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span>შიდა: {results.links.internal} ({results.links.total > 0 ? Math.round((results.links.internal / results.links.total) * 100) : 0}%)</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div><span>გარე: {results.links.external} ({results.links.total > 0 ? Math.round((results.links.external / results.links.total) * 100) : 0}%)</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><span>გატეხილი: {results.links.broken}</span></div>
                </div>
              </div>
            </Section>

            {/* Technical */}
            <Section title="ტექნიკური დეტალები" icon={Icons.Shield} id="technical">
              <div className="grid grid-cols-1 gap-4 mt-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">სათაური (Title) - {results.technical.title.length} სიმბოლო</div>
                  <div className={`font-medium text-sm p-2 rounded border ${results.technical.title.isOptimal ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    {results.technical.title.value || '(არ არის)'}
                  </div>
                  <HorizontalBar value={results.technical.title.length} max={70} color={results.technical.title.isOptimal ? '#10b981' : '#f59e0b'} label={`${results.technical.title.length}/60 სიმბოლო ${results.technical.title.length > 60 ? '⚠️ გრძელია' : '✓'}`} />
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">მეტა აღწერა - {results.technical.metaDesc.length} სიმბოლო</div>
                  <div className={`font-medium text-sm p-2 rounded border ${results.technical.metaDesc.isOptimal ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    {results.technical.metaDesc.value || '(არ არის)'}
                  </div>
                  <HorizontalBar value={results.technical.metaDesc.length} max={170} color={results.technical.metaDesc.isOptimal ? '#10b981' : '#f59e0b'} label={`${results.technical.metaDesc.length}/160 სიმბოლო ${results.technical.metaDesc.length > 160 ? '⚠️ გრძელია' : results.technical.metaDesc.length === 0 ? '⚠️ აკლია' : '✓'}`} />
                </div>
                {results.technical.canonical.href && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">Canonical URL</div>
                    <code className="font-medium text-sm p-2 rounded border bg-blue-50 border-blue-200 block break-all">
                      {results.technical.canonical.href}
                    </code>
                  </div>
                )}
              </div>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-3">ტექნიკური შემოწმებები</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <CheckBadge ok={!!results.technical.viewport.isMobileOptimized} label="Viewport" />
                  <CheckBadge ok={!!results.technical.charset} label="Charset" />
                  <CheckBadge ok={!!results.technical.language} label={`Lang: ${results.technical.language || '—'}`} />
                  <CheckBadge ok={results.technical.favicon} label="Favicon" />
                  <CheckBadge ok={results.security.isHttps} label="HTTPS" />
                  <CheckBadge ok={!results.technical.robots.hasNoindex} label={results.technical.robots.hasNoindex ? 'NOINDEX!' : 'Indexable'} />
                  <CheckBadge ok={!results.platform.isCSR} label={results.platform.isCSR ? 'CSR' : 'SSR/SSG'} />
                  <CheckBadge ok={results.technical.llmsTxt?.found || false} label="llms.txt" />
                  <CheckBadge ok={results.technical.sitemap?.pageInSitemap ?? false} label={`Sitemap${results.technical.sitemap?.urlCount ? ` (${results.technical.sitemap.urlCount})` : ''}`} />
                  <CheckBadge ok={results.accessibility.hasSkipLink} label="Skip Link" />
                  <CheckBadge ok={results.technical.appleTouchIcon} label="Apple Icon" />
                  <CheckBadge ok={results.technical.manifestJson || false} label="Manifest" />
                  <CheckBadge ok={!!results.technical.canonical.href} label="Canonical" />
                </div>
              </div>
            </Section>

            {/* DOM Analysis */}
            {results.dom && (
              <Section title="DOM ანალიზი" icon={Icons.DOM} id="dom">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className={`text-2xl font-bold ${results.dom.totalElements > 1500 ? 'text-red-600' : 'text-gray-800'}`}>{results.dom.totalElements.toLocaleString()}</div>
                    <div className="text-sm text-gray-500">ელემენტი</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className={`text-2xl font-bold ${results.dom.maxDepth > 32 ? 'text-red-600' : 'text-gray-800'}`}>{results.dom.maxDepth}</div>
                    <div className="text-sm text-gray-500">მაქს. სიღრმე</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-800">{results.dom.averageDepth}</div>
                    <div className="text-sm text-gray-500">საშ. სიღრმე</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className={`text-2xl font-bold ${results.dom.duplicateIds.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{results.dom.duplicateIds.length}</div>
                    <div className="text-sm text-gray-500">დუბლ. ID</div>
                  </div>
                </div>
                {results.dom.deprecatedElements.length > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                    <div className="text-sm font-medium text-yellow-800">მოძველებული ელემენტები: {results.dom.deprecatedElements.join(', ')}</div>
                  </div>
                )}
              </Section>
            )}

            {/* Mobile Friendliness */}
            {results.mobile && (
              <Section title="მობილური მეგობრულობა" icon={Icons.Smartphone} id="mobile">
                <div className="mt-4">
                  {/* Mobile Score */}
                  <div className="flex items-center gap-6 mb-6">
                    <div className="relative">
                      <DonutChart value={results.mobile.score} size={100} strokeWidth={10} color={results.mobile.score >= 80 ? '#10b981' : results.mobile.score >= 50 ? '#f59e0b' : '#ef4444'} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold">{results.mobile.score}</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-800 text-lg">მობილური ქულა</div>
                      <div className="text-sm text-gray-500">
                        {results.mobile.score >= 80 ? 'კარგი მობილური გამოცდილება' : results.mobile.score >= 50 ? 'საჭიროებს გაუმჯობესებას' : 'კრიტიკული პრობლემები'}
                      </div>
                    </div>
                  </div>

                  {/* Mobile Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={`p-4 rounded-lg text-center ${results.mobile.hasViewport && results.mobile.hasWidthDeviceWidth ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className={`text-2xl font-bold ${results.mobile.hasViewport && results.mobile.hasWidthDeviceWidth ? 'text-green-700' : 'text-red-700'}`}>
                        {results.mobile.hasViewport && results.mobile.hasWidthDeviceWidth ? '✓' : '✗'}
                      </div>
                      <div className="text-sm text-gray-600">Viewport</div>
                    </div>
                    <div className={`p-4 rounded-lg text-center ${results.mobile.smallTapTargets === 0 ? 'bg-green-50' : 'bg-orange-50'}`}>
                      <div className={`text-2xl font-bold ${results.mobile.smallTapTargets === 0 ? 'text-green-700' : 'text-orange-700'}`}>{results.mobile.smallTapTargets}</div>
                      <div className="text-sm text-gray-600">პატარა Tap Target</div>
                    </div>
                    <div className={`p-4 rounded-lg text-center ${results.mobile.hasMediaQueries || results.mobile.hasFlexbox || results.mobile.hasGrid ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className={`text-2xl font-bold ${results.mobile.hasMediaQueries || results.mobile.hasFlexbox || results.mobile.hasGrid ? 'text-green-700' : 'text-red-700'}`}>
                        {results.mobile.hasMediaQueries || results.mobile.hasFlexbox || results.mobile.hasGrid ? '✓' : '✗'}
                      </div>
                      <div className="text-sm text-gray-600">რესპონსიული</div>
                    </div>
                    <div className={`p-4 rounded-lg text-center ${!results.mobile.horizontalScrollRisk ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className={`text-2xl font-bold ${!results.mobile.horizontalScrollRisk ? 'text-green-700' : 'text-red-700'}`}>
                        {!results.mobile.horizontalScrollRisk ? '✓' : '✗'}
                      </div>
                      <div className="text-sm text-gray-600">სიგანე OK</div>
                    </div>
                  </div>

                  {/* Detailed Mobile Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="font-medium text-gray-700 mb-2">რესპონსიული დიზაინი</div>
                      <div className="space-y-1 text-sm">
                        <CheckBadge ok={results.mobile.hasMediaQueries} label={`Media Queries (${results.mobile.mediaQueryCount})`} />
                        <CheckBadge ok={results.mobile.hasFlexbox} label="Flexbox" />
                        <CheckBadge ok={results.mobile.hasGrid} label="CSS Grid" />
                        <CheckBadge ok={results.mobile.usesRelativeFontSizes} label="რელატიური ფონტი (rem/em)" />
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="font-medium text-gray-700 mb-2">მობილური მეტა</div>
                      <div className="space-y-1 text-sm">
                        <CheckBadge ok={results.mobile.hasThemeColor} label="Theme Color" />
                        <CheckBadge ok={results.mobile.hasAppleTouchIcon} label="Apple Touch Icon" />
                        <CheckBadge ok={results.mobile.hasManifest} label="Web App Manifest" />
                        <CheckBadge ok={!results.mobile.hasUserScalable} label="მასშტაბირება ნებადართული" />
                      </div>
                    </div>
                  </div>

                  {/* Responsive Images */}
                  {results.mobile.totalImages > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm text-blue-800">
                        <span className="font-medium">რესპონსიული სურათები:</span> {results.mobile.responsiveImagesCount} / {results.mobile.totalImages}
                        {results.mobile.responsiveImagesCount < results.mobile.totalImages * 0.5 && (
                          <span className="text-orange-600 ml-2">— რეკომენდებულია srcset გამოყენება</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mobile Issues */}
                  {results.mobile.issues.length > 0 && (
                    <div className="mt-4 p-4 bg-red-50 rounded-lg">
                      <div className="font-medium text-red-800 mb-2">აღმოჩენილი პრობლემები:</div>
                      <ul className="space-y-1">
                        {results.mobile.issues.map((issue, i) => (
                          <li key={i} className="text-sm text-red-700 flex gap-2">
                            <span className="text-red-500">•</span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Accessibility */}
            <Section title="ხელმისაწვდომობა (A11y)" icon={Icons.Eye} id="accessibility">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                <div className={`p-4 rounded-lg text-center ${results.accessibility.buttonsWithoutLabel === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className={`text-2xl font-bold ${results.accessibility.buttonsWithoutLabel === 0 ? 'text-green-700' : 'text-red-700'}`}>{results.accessibility.buttonsWithoutLabel}</div>
                  <div className="text-sm text-gray-600">ღილაკი ლეიბლის გარეშე</div>
                </div>
                <div className={`p-4 rounded-lg text-center ${results.accessibility.inputsWithoutLabel === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className={`text-2xl font-bold ${results.accessibility.inputsWithoutLabel === 0 ? 'text-green-700' : 'text-red-700'}`}>{results.accessibility.inputsWithoutLabel}</div>
                  <div className="text-sm text-gray-600">ველი ლეიბლის გარეშე</div>
                </div>
                <div className={`p-4 rounded-lg text-center ${results.accessibility.linksWithoutText === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className={`text-2xl font-bold ${results.accessibility.linksWithoutText === 0 ? 'text-green-700' : 'text-red-700'}`}>{results.accessibility.linksWithoutText}</div>
                  <div className="text-sm text-gray-600">ბმული ტექსტის გარეშე</div>
                </div>
                <div className={`p-4 rounded-lg text-center ${results.accessibility.colorContrastIssues === 0 ? 'bg-green-50' : 'bg-orange-50'}`}>
                  <div className={`text-2xl font-bold ${results.accessibility.colorContrastIssues === 0 ? 'text-green-700' : 'text-orange-700'}`}>{results.accessibility.colorContrastIssues}</div>
                  <div className="text-sm text-gray-600">კონტრასტის პრობლემა</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-700">{results.accessibility.aria?.ariaLabels || 0}</div>
                  <div className="text-sm text-gray-600">ARIA Labels</div>
                </div>
              </div>
              {/* Contrast Details */}
              {results.accessibility.contrastDetails && results.accessibility.contrastDetails.lowContrastElements.length > 0 && (
                <div className="mt-4 p-4 bg-orange-50 rounded-lg">
                  <div className="font-medium text-orange-800 mb-2">კონტრასტის პრობლემები (WCAG AA: 4.5:1):</div>
                  {/* Section Summary */}
                  {results.accessibility.contrastDetails.sectionIssues && results.accessibility.contrastDetails.sectionIssues.length > 0 && (
                    <div className="mb-3 p-3 bg-orange-100 rounded">
                      <div className="text-sm font-medium text-orange-800 mb-2">სექციები დაბალი კონტრასტით:</div>
                      <div className="flex flex-wrap gap-2">
                        {results.accessibility.contrastDetails.sectionIssues.map((sec, i) => (
                          <span key={i} className="px-2 py-1 bg-orange-200 text-orange-800 rounded text-sm">
                            {sec.section}: {sec.count} პრობლემა
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {results.accessibility.contrastDetails.lowContrastElements.map((item, i) => (
                      <div key={i} className="text-sm text-orange-700 flex gap-2 items-center">
                        <span className="text-orange-500">•</span>
                        {item.section && <span className="text-xs bg-orange-200 px-1.5 py-0.5 rounded">{item.section}</span>}
                        <span className="font-mono bg-orange-100 px-1 rounded">&lt;{item.element}&gt;</span>
                        <span className="truncate max-w-xs">{item.text}</span>
                        <span className="text-orange-600">({item.ratio})</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-orange-600">
                    WCAG AA: {results.accessibility.contrastDetails.passedWCAG_AA ? '✓ გავლილი' : '✗ ვერ გაიარა'} |
                    WCAG AAA: {results.accessibility.contrastDetails.passedWCAG_AAA ? '✓ გავლილი' : '✗ ვერ გაიარა'}
                  </div>
                </div>
              )}
              {results.accessibility.aria?.missingLandmarks && results.accessibility.aria.missingLandmarks.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <div className="text-sm font-medium text-yellow-800">აკლია Landmarks: {results.accessibility.aria.missingLandmarks.join(', ')}</div>
                </div>
              )}
            </Section>

            {/* Performance */}
            <Section title="სიჩქარე" icon={Icons.Zap} id="performance">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-800">{results.performance.totalScripts}</div>
                  <div className="text-sm text-gray-500">სკრიპტები</div>
                </div>
                <div className={`p-4 rounded-lg text-center ${results.performance.renderBlockingScripts > 3 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className={`text-2xl font-bold ${results.performance.renderBlockingScripts > 3 ? 'text-red-700' : 'text-green-700'}`}>{results.performance.renderBlockingScripts}</div>
                  <div className="text-sm text-gray-500">მბლოკავი სკრიპტი</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-800">{results.performance.preloads}</div>
                  <div className="text-sm text-gray-500">Preloads</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-800">{results.performance.estimatedWeight || '—'}</div>
                  <div className="text-sm text-gray-500">HTML ზომა</div>
                </div>
              </div>
            </Section>

            {/* International / Hreflang */}
            {results.international.hreflangs.length > 0 && (
              <Section title="Hreflang / საერთაშორისო" icon={Icons.Languages} id="international" badge={<span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-sm">{results.international.hreflangs.length} ენა</span>}>
                <div className="mt-4 space-y-2">
                  {results.international.hreflangs.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
                      <span className="font-mono font-semibold text-gray-700 w-20">{h.hreflang}</span>
                      <span className="text-gray-600 truncate flex-1">{h.href}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <CheckBadge ok={results.international.hasXDefault} label="x-default" />
                  <CheckBadge ok={results.international.hasSelfReference} label="Self-reference" />
                  <CheckBadge ok={results.international.canonicalInHreflang || false} label="Canonical in hreflang" />
                  <CheckBadge ok={results.international.langMatchesHreflang || false} label="Lang matches hreflang" />
                </div>
              </Section>
            )}

            {/* Links */}
            <Section title="ბმულები" icon={Icons.Link} id="links">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg"><div className="text-2xl font-bold text-blue-700">{results.links.total}</div><div className="text-sm text-blue-600">სულ</div></div>
                <div className="text-center p-4 bg-green-50 rounded-lg"><div className="text-2xl font-bold text-green-700">{results.links.internal}</div><div className="text-sm text-green-600">შიდა</div></div>
                <div className="text-center p-4 bg-purple-50 rounded-lg"><div className="text-2xl font-bold text-purple-700">{results.links.external}</div><div className="text-sm text-purple-600">გარე</div></div>
                <div className={`text-center p-4 rounded-lg ${results.links.broken > 0 ? 'bg-red-50' : 'bg-gray-50'}`}><div className={`text-2xl font-bold ${results.links.broken > 0 ? 'text-red-700' : 'text-gray-700'}`}>{results.links.broken}</div><div className="text-sm text-gray-600">ცარიელი</div></div>
                <div className={`text-center p-4 rounded-lg ${(results.links.brokenExternalLinks || 0) > 0 ? 'bg-red-50' : 'bg-gray-50'}`}><div className={`text-2xl font-bold ${(results.links.brokenExternalLinks || 0) > 0 ? 'text-red-700' : 'text-gray-700'}`}>{results.links.brokenExternalLinks || 0}</div><div className="text-sm text-gray-600">404 გარე</div></div>
                <div className={`text-center p-4 rounded-lg ${results.links.genericAnchors > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}><div className={`text-2xl font-bold ${results.links.genericAnchors > 0 ? 'text-yellow-700' : 'text-gray-700'}`}>{results.links.genericAnchors}</div><div className="text-sm text-gray-600">ზოგადი</div></div>
              </div>
            </Section>

            {/* Images */}
            <Section title="სურათები" icon={Icons.Image} id="images">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg"><div className="text-2xl font-bold text-gray-700">{results.images.total}</div><div className="text-sm text-gray-600">სულ</div></div>
                <div className={`text-center p-4 rounded-lg ${results.images.withoutAlt > 0 ? 'bg-red-50' : 'bg-green-50'}`}><div className={`text-2xl font-bold ${results.images.withoutAlt > 0 ? 'text-red-700' : 'text-green-700'}`}>{results.images.withoutAlt}</div><div className="text-sm text-gray-600">alt-ის გარეშე</div></div>
                <div className={`text-center p-4 rounded-lg ${results.images.withoutDimensions > 0 ? 'bg-orange-50' : 'bg-green-50'}`}><div className={`text-2xl font-bold ${results.images.withoutDimensions > 0 ? 'text-orange-700' : 'text-green-700'}`}>{results.images.withoutDimensions}</div><div className="text-sm text-gray-600">ზომის გარეშე</div></div>
                <div className="text-center p-4 bg-green-50 rounded-lg"><div className="text-2xl font-bold text-green-700">{results.images.lazyLoaded}</div><div className="text-sm text-green-600">lazy loading</div></div>
                <div className="text-center p-4 bg-teal-50 rounded-lg"><div className="text-2xl font-bold text-teal-700">{results.images.modernFormats || 0}</div><div className="text-sm text-teal-600">WebP/AVIF</div></div>
                <div className={`text-center p-4 rounded-lg ${(results.images.imageSizeAnalysis?.largeCount || 0) > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}><div className={`text-2xl font-bold ${(results.images.imageSizeAnalysis?.largeCount || 0) > 0 ? 'text-yellow-700' : 'text-green-700'}`}>{results.images.imageSizeAnalysis?.largeCount || 0}</div><div className="text-sm text-gray-600">&gt;200KB</div></div>
              </div>
              {/* Large images list */}
              {results.images.imageSizeAnalysis?.largeList && results.images.imageSizeAnalysis.largeList.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-sm">
                  <div className="font-medium text-yellow-800 mb-2">დიდი ზომის სურათები:</div>
                  {results.images.imageSizeAnalysis.largeList.slice(0, 5).map((img, i) => (
                    <div key={i} className="flex gap-2 text-yellow-700">
                      <span className="text-yellow-600">•</span>
                      <span className="truncate max-w-xs">{img.src.split('/').pop()}</span>
                      <span className="font-medium">{img.size}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Schema */}
            {results.schema.count > 0 && (
              <Section title="Schema.org" icon={Icons.Code} id="schema" badge={<span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-sm">{results.schema.count}</span>}>
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {results.schema.types.map((t, i) => <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">{t}</span>)}
                  </div>
                  <div className="text-sm text-gray-500 mt-3">{results.schema.valid} ვალიდური{results.schema.invalid > 0 && <span className="text-red-600">, {results.schema.invalid} არავალიდური</span>}</div>
                </div>
              </Section>
            )}

            {/* Social */}
            <Section title="სოციალური ქსელები" icon={Icons.Share} id="social">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="font-medium text-blue-800 mb-2">Open Graph</div>
                  <div className="text-sm space-y-1">
                    <CheckBadge ok={!!results.social.og.title} label="og:title" />
                    <CheckBadge ok={!!results.social.og.description} label="og:description" />
                    <CheckBadge ok={!!results.social.og.image} label="og:image" />
                    <CheckBadge ok={!!results.social.og.url} label="og:url" />
                  </div>
                </div>
                <div className="p-4 bg-sky-50 rounded-lg">
                  <div className="font-medium text-sky-800 mb-2">Twitter Card</div>
                  <div className="text-sm space-y-1">
                    <CheckBadge ok={!!results.social.twitter.card} label={`card: ${results.social.twitter.card || '—'}`} />
                    <CheckBadge ok={!!results.social.twitter.image} label="image" />
                  </div>
                </div>
              </div>
            </Section>

            {/* Platform */}
            <Section title="პლატფორმა" icon={Icons.Zap} id="platform">
              <div className="mt-4 space-y-3">
                {results.platform.cms.length > 0 && <div className="flex items-center gap-2 flex-wrap"><span className="text-gray-500">CMS:</span>{results.platform.cms.map((c, i) => <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">{c}</span>)}</div>}
                {results.platform.frameworks.length > 0 && <div className="flex items-center gap-2 flex-wrap"><span className="text-gray-500">Framework:</span>{results.platform.frameworks.map((f, i) => <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">{f}</span>)}</div>}
                {results.platform.analytics && results.platform.analytics.length > 0 && <div className="flex items-center gap-2 flex-wrap"><span className="text-gray-500">Analytics:</span>{results.platform.analytics.map((a, i) => <span key={i} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm">{a}</span>)}</div>}
                <div className="flex items-center gap-2"><span className="text-gray-500">რენდერი:</span><span className={`px-2 py-1 rounded text-sm ${results.platform.isCSR ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{results.platform.renderMethod}</span></div>
              </div>
            </Section>

            {/* External Resources */}
            {results.externalResources && (
              <Section title="გარე რესურსები" icon={Icons.Server} id="external-resources">
                <div className="mt-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-700">{results.externalResources.cssCount}</div>
                      <div className="text-sm text-gray-600">CSS ფაილი</div>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-yellow-700">{results.externalResources.jsCount}</div>
                      <div className="text-sm text-gray-600">JS ფაილი</div>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-purple-700">{results.externalResources.fontCount}</div>
                      <div className="text-sm text-gray-600">ფონტი</div>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-orange-700">{results.externalResources.thirdPartyCount}</div>
                      <div className="text-sm text-gray-600">Third-party დომენი</div>
                    </div>
                  </div>

                  {/* CSS Files */}
                  {results.externalResources.cssFiles.length > 0 && (
                    <div className="mb-4">
                      <div className="font-medium text-gray-700 mb-2">CSS ფაილები:</div>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                        {results.externalResources.cssFiles.slice(0, 10).map((file, i) => (
                          <div key={i} className="text-sm text-gray-600 flex items-center gap-2 py-1">
                            <span className={`w-2 h-2 rounded-full ${file.isThirdParty ? 'bg-orange-400' : 'bg-green-400'}`}></span>
                            <span className="truncate font-mono text-xs">{file.url}</span>
                            {file.isThirdParty && <span className="text-xs text-orange-600">(third-party)</span>}
                          </div>
                        ))}
                        {results.externalResources.cssFiles.length > 10 && (
                          <div className="text-xs text-gray-500 mt-1">+{results.externalResources.cssFiles.length - 10} მეტი...</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* JS Files */}
                  {results.externalResources.jsFiles.length > 0 && (
                    <div className="mb-4">
                      <div className="font-medium text-gray-700 mb-2">JavaScript ფაილები:</div>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                        {results.externalResources.jsFiles.slice(0, 10).map((file, i) => (
                          <div key={i} className="text-sm text-gray-600 flex items-center gap-2 py-1">
                            <span className={`w-2 h-2 rounded-full ${file.isThirdParty ? 'bg-orange-400' : 'bg-green-400'}`}></span>
                            <span className="truncate font-mono text-xs flex-1">{file.url}</span>
                            <span className="flex gap-1">
                              {file.async && <span className="text-xs bg-green-100 text-green-700 px-1 rounded">async</span>}
                              {file.defer && <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">defer</span>}
                              {file.module && <span className="text-xs bg-purple-100 text-purple-700 px-1 rounded">module</span>}
                            </span>
                          </div>
                        ))}
                        {results.externalResources.jsFiles.length > 10 && (
                          <div className="text-xs text-gray-500 mt-1">+{results.externalResources.jsFiles.length - 10} მეტი...</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Google Fonts */}
                  {results.externalResources.googleFonts.length > 0 && (
                    <div className="mb-4">
                      <div className="font-medium text-gray-700 mb-2">Google Fonts:</div>
                      <div className="flex flex-wrap gap-2">
                        {results.externalResources.googleFonts.map((font, i) => (
                          <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">{font}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Third-party Domains */}
                  {results.externalResources.thirdPartyDomains.length > 0 && (
                    <div className="mb-4">
                      <div className="font-medium text-gray-700 mb-2">Third-party დომენები:</div>
                      <div className="flex flex-wrap gap-2">
                        {results.externalResources.thirdPartyDomains.map((domain, i) => (
                          <span key={i} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm font-mono">{domain}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Preconnects */}
                  {results.externalResources.suggestedPreconnects.length > 0 && (
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <div className="text-sm font-medium text-yellow-800 mb-1">რეკომენდებული preconnect:</div>
                      <div className="text-xs text-yellow-700 space-y-1">
                        {results.externalResources.suggestedPreconnects.map((domain, i) => (
                          <div key={i} className="font-mono">&lt;link rel=&quot;preconnect&quot; href=&quot;https://{domain}&quot;&gt;</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* AI Content */}
            {results.content.aiScore > 20 && (
              <Section title="AI კონტენტის ანალიზი" icon={Icons.Brain} id="ai">
                <div className="mt-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <DonutChart value={results.content.aiScore} size={80} strokeWidth={8} color={results.content.aiScore > 50 ? '#ef4444' : '#f59e0b'} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold">{results.content.aiScore}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">AI კონტენტის ინდიკატორი</div>
                      <div className="text-sm text-gray-500">მაღალი მნიშვნელობა მიუთითებს AI-გენერირებულ კონტენტზე</div>
                    </div>
                  </div>
                  {results.content.aiPhrases.length > 0 && (
                    <div className="mt-3 text-sm text-gray-600">
                      ნაპოვნი ფრაზები: {results.content.aiPhrases.slice(0, 5).join(', ')}{results.content.aiPhrases.length > 5 && ` +${results.content.aiPhrases.length - 5}`}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Trust Signals */}
            <Section title="სანდოობა (E-E-A-T)" icon={Icons.Users} id="trust">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                <div className={`p-3 rounded-lg text-center ${results.trustSignals.hasAboutPage ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className={`text-2xl mb-1 ${results.trustSignals.hasAboutPage ? 'text-green-600' : 'text-gray-400'}`}>{results.trustSignals.hasAboutPage ? '✓' : '—'}</div>
                  <div className="text-sm text-gray-600">ჩვენს შესახებ</div>
                </div>
                <div className={`p-3 rounded-lg text-center ${results.trustSignals.hasContactPage ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className={`text-2xl mb-1 ${results.trustSignals.hasContactPage ? 'text-green-600' : 'text-gray-400'}`}>{results.trustSignals.hasContactPage ? '✓' : '—'}</div>
                  <div className="text-sm text-gray-600">კონტაქტი</div>
                </div>
                <div className={`p-3 rounded-lg text-center ${results.trustSignals.hasPrivacyPage ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className={`text-2xl mb-1 ${results.trustSignals.hasPrivacyPage ? 'text-green-600' : 'text-gray-400'}`}>{results.trustSignals.hasPrivacyPage ? '✓' : '—'}</div>
                  <div className="text-sm text-gray-600">კონფიდენც.</div>
                </div>
                <div className={`p-3 rounded-lg text-center ${results.trustSignals.hasAuthor ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className={`text-2xl mb-1 ${results.trustSignals.hasAuthor ? 'text-green-600' : 'text-gray-400'}`}>{results.trustSignals.hasAuthor ? '✓' : '—'}</div>
                  <div className="text-sm text-gray-600">ავტორი</div>
                </div>
                <div className={`p-3 rounded-lg text-center ${results.trustSignals.socialLinksCount > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className={`text-2xl font-bold mb-1 ${results.trustSignals.socialLinksCount > 0 ? 'text-green-600' : 'text-gray-400'}`}>{results.trustSignals.socialLinksCount || '—'}</div>
                  <div className="text-sm text-gray-600">სოც. ბმულები</div>
                </div>
              </div>
              {results.trustSignals.socialPlatforms && results.trustSignals.socialPlatforms.length > 0 && (
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <span className="text-gray-500 text-sm">სოც. ქსელები:</span>
                  {results.trustSignals.socialPlatforms.map((s, i) => <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">{s}</span>)}
                </div>
              )}
            </Section>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-gray-400 text-sm">
        SEO აუდიტი • სრული SEO ანალიზი • {new Date().getFullYear()}
      </div>
    </div>
  );
}
