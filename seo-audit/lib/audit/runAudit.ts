// lib/audit/runAudit.ts

import { JSDOM } from 'jsdom';
import { PATTERNS } from '../checks/patterns';
import type {
  AuditResult,
  AuditIssue,
  TechnicalData,
  InternationalData,
  ContentData,
  LinkData,
  ImageData,
  SchemaData,
  SchemaItem,
  SocialData,
  AccessibilityData,
  PerformanceData,
  SecurityData,
  PlatformData,
  TrustSignalsData,
} from './types';

export async function runAudit(html: string, inputUrl: string): Promise<AuditResult> {
  const dom = new JSDOM(html, { url: inputUrl });
  const doc = dom.window.document;

  const url = inputUrl || extractUrl(doc) || 'unknown';
  const baseUrl = extractBaseUrl(url);

  // Run all checks
  const technical = checkTechnical(doc, url);
  const international = checkInternational(doc, url);
  const content = checkContent(doc, technical.title.value);
  const links = checkLinks(doc, baseUrl);
  const images = checkImages(doc);
  const schema = checkSchema(doc);
  const social = checkSocial(doc);
  const accessibility = checkAccessibility(doc);
  const performance = checkPerformance(doc, html);
  const security = checkSecurity(doc, html, url);
  const platform = detectPlatform(html, doc);
  const trustSignals = checkTrustSignals(doc, schema);

  // Collect issues and passed checks
  const issues = collectIssues({
    technical,
    international,
    content,
    links,
    images,
    schema,
    social,
    accessibility,
    performance,
    security,
    platform,
  });

  const passed = collectPassed({
    technical,
    international,
    content,
    links,
    images,
    schema,
    social,
    accessibility,
    performance,
    security,
    trustSignals,
  });

  const score = calculateScore(issues, passed);

  return {
    url,
    score,
    timestamp: new Date().toISOString(),
    fetchMethod: 'html',
    summary: {
      criticalIssues: issues.filter((i) => i.severity === 'critical').length,
      highIssues: issues.filter((i) => i.severity === 'high').length,
      mediumIssues: issues.filter((i) => i.severity === 'medium').length,
      lowIssues: issues.filter((i) => i.severity === 'low').length,
      totalChecks: issues.length + passed.length,
      passedChecks: passed.length,
    },
    technical,
    international,
    content,
    links,
    images,
    schema,
    social,
    accessibility,
    performance,
    security,
    platform,
    trustSignals,
    issues,
    passed,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractUrl(doc: Document): string | null {
  return (
    doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ||
    doc.querySelector('meta[property="og:url"]')?.getAttribute('content') ||
    null
  );
}

function extractBaseUrl(url: string): string {
  try {
    const p = new URL(url);
    return `${p.protocol}//${p.host}`;
  } catch {
    return '';
  }
}

// ============================================
// 1. TECHNICAL CHECKS
// ============================================

function checkTechnical(doc: Document, sourceUrl: string): TechnicalData {
  // Title
  const title = doc.querySelector('title')?.textContent?.trim() || '';

  // Meta Description
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';

  // Canonical
  const canonicals = Array.from(doc.querySelectorAll('link[rel="canonical"]'));
  const canonicalHref = canonicals[0]?.getAttribute('href') || null;
  let isCrossDomain = false;
  if (canonicalHref && sourceUrl) {
    try {
      const canonicalHost = new URL(canonicalHref).hostname;
      const sourceHost = new URL(sourceUrl).hostname;
      isCrossDomain = canonicalHost !== sourceHost;
    } catch {}
  }

  // Robots meta
  const robotsMeta = doc.querySelector('meta[name="robots"]')?.getAttribute('content')?.toLowerCase() || '';
  const googlebotMeta = doc.querySelector('meta[name="googlebot"]')?.getAttribute('content')?.toLowerCase() || '';
  const combinedRobots = `${robotsMeta} ${googlebotMeta}`;

  // Viewport
  const viewportContent = doc.querySelector('meta[name="viewport"]')?.getAttribute('content') || null;
  const isMobileOptimized = viewportContent?.includes('width=device-width') || false;

  // Charset
  const charset =
  doc.querySelector('meta[charset]')?.getAttribute('charset') ||
  doc.querySelector('meta[http-equiv="Content-Type"]')?.getAttribute('content') ||
  null;

  return {
    title: {
      value: title,
      length: title.length,
      isOptimal: title.length >= 30 && title.length <= 60,
    },
    metaDesc: {
      value: metaDesc,
      length: metaDesc.length,
      isOptimal: metaDesc.length >= 120 && metaDesc.length <= 160,
    },
    canonical: {
      href: canonicalHref,
      count: canonicals.length,
      isCrossDomain,
    },
    robots: {
      meta: robotsMeta || null,
      hasNoindex: combinedRobots.includes('noindex'),
      hasNofollow: combinedRobots.includes('nofollow'),
    },
    robotsTxt: { found: false, content: null, blocksAll: false, hasSitemap: false },
    sitemap: { found: false, url: null },
    language: doc.documentElement.getAttribute('lang') || null,
    charset: charset,
    viewport: {
      content: viewportContent,
      isMobileOptimized,
    },
    favicon: !!doc.querySelector('link[rel="icon"], link[rel="shortcut icon"]'),
    appleTouchIcon: !!doc.querySelector('link[rel="apple-touch-icon"]'),
  };
}

// ============================================
// 2. INTERNATIONAL / HREFLANG CHECKS
// ============================================

function checkInternational(doc: Document, sourceUrl: string): InternationalData {
  const hreflangElements = Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]'));
  const hreflangs = hreflangElements.map((el) => ({
    hreflang: el.getAttribute('hreflang') || '',
                                                  href: el.getAttribute('href') || '',
  }));

  const issues: string[] = [];
  const hasXDefault = hreflangs.some((h) => h.hreflang === 'x-default');

  // Check self-reference
  let hasSelfReference = false;
  if (sourceUrl && hreflangs.length > 0) {
    const normalizedSource = sourceUrl.toLowerCase().replace(/\/$/, '');
    hasSelfReference = hreflangs.some((h) => h.href?.toLowerCase().replace(/\/$/, '') === normalizedSource);
  }

  // Validate each hreflang
  hreflangs.forEach((h, i) => {
    // Check for absolute URLs
    if (h.href && !h.href.startsWith('http')) {
      issues.push(`hreflang #${i + 1}: რელატიური URL`);
    }

    // Check region code format (should be lowercase-UPPERCASE like en-US)
    if (h.hreflang && h.hreflang !== 'x-default' && h.hreflang.includes('-')) {
      const parts = h.hreflang.split('-');
      if (parts.length === 2) {
        const regionCode = parts[1];
        if (regionCode !== regionCode.toUpperCase()) {
          issues.push(`hreflang #${i + 1}: არასწორი ფორმატი (${h.hreflang})`);
        }
      }
    }
  });

  return {
    hreflangs,
    hasXDefault,
    hasSelfReference,
    issues,
  };
}

// ============================================
// 3. CONTENT CHECKS
// ============================================

function checkContent(doc: Document, title: string): ContentData {
  const getHeadings = (tag: string) =>
  Array.from(doc.querySelectorAll(tag)).map((h) => h.textContent?.trim() || '');

  const text = doc.body?.textContent || '';
  const words = text.split(/\s+/).filter((w) => w.length > 0);

  const h1Values = getHeadings('h1');

  // Title vs H1 duplicate check
  const titleH1Duplicate: boolean =
  !!(title &&
  h1Values.length > 0 &&
  title.toLowerCase().trim() === h1Values[0].toLowerCase().trim());

  // Duplicate paragraphs
  const paragraphs = Array.from(doc.querySelectorAll('p'))
  .map((p) => p.textContent?.trim() || '')
  .filter((p) => p.length > 50);
  const duplicateParagraphs = paragraphs.filter((p, i, arr) => arr.indexOf(p) !== i).length;

  // AI content detection
  const bodyTextLower = text.toLowerCase();
  let aiScore = 0;
  const aiPhrases: string[] = [];

  PATTERNS.AI_PHRASES.forEach((phrase: string) => {
    const regex = new RegExp(phrase, 'gi');
    const matches = bodyTextLower.match(regex);
    if (matches) {
      aiScore += matches.length * 5;
      aiPhrases.push(`"${phrase}" (${matches.length}x)`);
    }
  });
  aiScore = Math.min(aiScore, 100);

  return {
    headings: {
      h1: h1Values,
      h2: getHeadings('h2'),
      h3: getHeadings('h3'),
      h4: getHeadings('h4'),
      h5: getHeadings('h5'),
      h6: getHeadings('h6'),
    },
    wordCount: words.length,
    readingTime: Math.ceil(words.length / 200),
    titleH1Duplicate,
    duplicateParagraphs,
    aiScore,
    aiPhrases,
  };
}

// ============================================
// 4. LINK CHECKS
// ============================================

function checkLinks(doc: Document, baseUrl: string): LinkData {
  const links = Array.from(doc.querySelectorAll('a[href]'));
  let internal = 0,
  external = 0,
  broken = 0,
  nofollow = 0,
  genericAnchors = 0,
  unsafeExternalCount = 0;

  const brokenList: { href: string; text: string }[] = [];
  const genericAnchorsList: { text: string; href: string }[] = [];

  let sourceHost = '';
  try {
    sourceHost = new URL(baseUrl).hostname;
  } catch {}

  links.forEach((link) => {
    const href = link.getAttribute('href') || '';
    const text = link.textContent?.trim().toLowerCase() || '';
    const rel = link.getAttribute('rel') || '';
    const target = link.getAttribute('target') || '';

    // Check for broken/empty links
  if (!href || PATTERNS.BROKEN_HREFS.includes(href.toLowerCase())) {
    broken++;
    if (brokenList.length < 15) {
      brokenList.push({ href, text: link.textContent?.trim().substring(0, 50) || '' });
    }
  }

  // Classify internal vs external
  if (href.startsWith('http')) {
    try {
      const linkHost = new URL(href).hostname;
      if (linkHost === sourceHost) {
        internal++;
      } else {
        external++;
        // Check for unsafe external links (target="_blank" without rel="noopener")
        if (target === '_blank' && !rel.includes('noopener')) {
          unsafeExternalCount++;
        }
      }
    } catch {
      internal++;
    }
  } else if (href.startsWith('/') || href.startsWith('./') || !href.includes(':')) {
    internal++;
  }

  if (rel.includes('nofollow')) nofollow++;

  // Generic anchor text check
  if (PATTERNS.GENERIC_ANCHORS.includes(text)) {
    genericAnchors++;
    if (genericAnchorsList.length < 10) {
      genericAnchorsList.push({ text, href });
    }
  }
  });

  return {
    total: links.length,
    internal,
    external,
    broken,
    brokenList,
    genericAnchors,
    genericAnchorsList,
    nofollow,
    unsafeExternalCount,
  };
}

// ============================================
// 5. IMAGE CHECKS
// ============================================

function checkImages(doc: Document): ImageData {
  const images = Array.from(doc.querySelectorAll('img'));
  let withoutAlt = 0,
  withoutDimensions = 0,
  lazyLoaded = 0,
  lazyAboveFold = 0,
  clickableWithoutAlt = 0;

  images.forEach((img, index) => {
    const alt = img.getAttribute('alt');
    if (alt === null) withoutAlt++;

    if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
      withoutDimensions++;
    }

    const isLazy = img.getAttribute('loading') === 'lazy';
  if (isLazy) {
    lazyLoaded++;
    // First 3 images are considered above-fold
    if (index < 3) lazyAboveFold++;
  }

  // Check clickable images (inside <a> or <button>)
  const parent = img.parentElement;
  if ((parent?.tagName === 'A' || parent?.tagName === 'BUTTON') && !alt) {
    clickableWithoutAlt++;
  }
  });

  return {
    total: images.length,
    withoutAlt,
    withoutDimensions,
    lazyLoaded,
    lazyAboveFold,
    clickableWithoutAlt,
  };
}

// ============================================
// 6. SCHEMA.ORG CHECKS
// ============================================

function checkSchema(doc: Document): SchemaData {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  const types: string[] = [];
  const details: SchemaItem[] = [];
  let valid = 0,
  invalid = 0,
  missingContext = 0;

  scripts.forEach((script, scriptIndex) => {
    try {
      const rawContent = script.textContent || '';
      const parsed = JSON.parse(rawContent);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      items.forEach((item, itemIndex) => {
        const schemaInfo: SchemaItem = {
          index: `${scriptIndex + 1}${items.length > 1 ? `.${itemIndex + 1}` : ''}`,
          type: item['@type'] || 'Unknown',
          valid: true,
          issues: [],
        };

        // Check @context
        if (!item['@context']) {
          schemaInfo.issues.push('აკლია @context');
          missingContext++;
        }

        const schemaType = item['@type'];
        if (schemaType && !types.includes(schemaType)) {
          types.push(schemaType);
        }

        // Validate specific schema types
        const requirements = PATTERNS.SCHEMA_REQUIREMENTS[schemaType];
        if (requirements) {
          // Check required fields
          if (requirements.required) {
            const missing = requirements.required.filter((field: string) => !item[field]);
            if (missing.length > 0) {
              schemaInfo.issues.push(`აკლია: ${missing.join(', ')}`);
            }
          }

          // Check "needs one of" fields
          if (requirements.needsOneOf) {
            const hasOne = requirements.needsOneOf.some((field: string) => item[field]);
            if (!hasOne) {
              schemaInfo.issues.push(`საჭიროა ერთ-ერთი: ${requirements.needsOneOf.join(', ')}`);
            }
          }
        }

        // Handle @graph
        if (item['@graph'] && Array.isArray(item['@graph'])) {
          item['@graph'].forEach((graphItem: any) => {
            if (graphItem['@type'] && !types.includes(graphItem['@type'])) {
              types.push(graphItem['@type']);
            }
          });
        }

        if (schemaInfo.issues.length > 0) {
          schemaInfo.valid = false;
        }

        details.push(schemaInfo);
        valid++;
      });
    } catch (e) {
      invalid++;
      details.push({
        index: `${scriptIndex + 1}`,
        type: 'Invalid JSON',
        valid: false,
        issues: ['არასწორი JSON სინტაქსი'],
      });
    }
  });

  return {
    count: scripts.length,
    types,
    valid,
    invalid,
    details,
    missingContext,
  };
}

// ============================================
// 7. SOCIAL MEDIA TAGS CHECKS
// ============================================

function checkSocial(doc: Document): SocialData {
  const get = (name: string) =>
  doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content') || null;

  const og = {
    title: get('og:title'),
    description: get('og:description'),
    image: get('og:image'),
    url: get('og:url'),
    type: get('og:type'),
  };

  const twitter = {
    card: get('twitter:card'),
    title: get('twitter:title'),
    description: get('twitter:description'),
    image: get('twitter:image'),
  };

  const isComplete = !!(og.title && og.description && og.image && og.url);

  return { og, twitter, isComplete };
}

// ============================================
// 8. ACCESSIBILITY CHECKS
// ============================================

function checkAccessibility(doc: Document): AccessibilityData {
  // Buttons without labels
  const buttons = Array.from(doc.querySelectorAll('button'));
  const buttonsWithoutLabel = buttons.filter((btn) => {
    const hasText = btn.textContent?.trim().length;
    const hasAriaLabel = btn.hasAttribute('aria-label') || btn.hasAttribute('aria-labelledby');
    const hasTitle = btn.hasAttribute('title');
    const hasImgAlt = btn.querySelector('img[alt]');
    return !hasText && !hasAriaLabel && !hasTitle && !hasImgAlt;
  }).length;

  // Inputs without labels
  const inputs = Array.from(doc.querySelectorAll('input, select, textarea'));
  const inputsWithoutLabel = inputs.filter((input) => {
    const id = input.getAttribute('id');
    const hasLabel = id && doc.querySelector(`label[for="${id}"]`);
    const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
    const hasPlaceholder = input.hasAttribute('placeholder');
    const isHidden = input.getAttribute('type') === 'hidden' || input.getAttribute('type') === 'submit';
    const parentLabel = input.closest('label');
    return !isHidden && !hasLabel && !hasAriaLabel && !hasPlaceholder && !parentLabel;
  }).length;

  // Links without discernible text
  const links = Array.from(doc.querySelectorAll('a'));
  const linksWithoutText = links.filter((a) => {
    const text = a.textContent?.trim();
    const ariaLabel = a.getAttribute('aria-label');
    const title = a.getAttribute('title');
    const imgAlt = a.querySelector('img[alt]');
    const svgTitle = a.querySelector('svg title');
    return !text && !ariaLabel && !title && !imgAlt && !svgTitle;
  }).length;

  // Iframes without title
  const iframesWithoutTitle = Array.from(doc.querySelectorAll('iframe')).filter(
    (f) => !f.hasAttribute('title')
  ).length;

  // Heading hierarchy
  const headings = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'));
  const skippedHeadings: string[] = [];
  let lastLevel = 0;
  headings.forEach((h) => {
    const level = parseInt(h.tagName[1]);
    if (lastLevel > 0 && level - lastLevel > 1) {
      skippedHeadings.push(`H${lastLevel} → H${level}`);
    }
    lastLevel = level;
  });

  // Skip link
  const hasSkipLink = !!doc.querySelector(
    'a[href="#main"], a[href="#content"], a[href="#main-content"], .skip-link, .skip-to-content, [class*="skip"]'
  );

  // Clickable images without alt
  const images = Array.from(doc.querySelectorAll('img'));
  const clickableImagesWithoutAlt = images.filter((img) => {
    const parent = img.parentElement;
    return (parent?.tagName === 'A' || parent?.tagName === 'BUTTON') && !img.getAttribute('alt');
  }).length;

  // Positive tabindex
  const positiveTabindex = Array.from(doc.querySelectorAll('[tabindex]')).filter((el) => {
    const val = parseInt(el.getAttribute('tabindex') || '0');
    return val > 0;
  }).length;

  return {
    buttonsWithoutLabel,
    inputsWithoutLabel,
    linksWithoutText,
    iframesWithoutTitle,
    skippedHeadings,
    hasSkipLink,
    hasLangAttribute: !!doc.documentElement.getAttribute('lang'),
    clickableImagesWithoutAlt,
    positiveTabindex,
  };
}

// ============================================
// 9. PERFORMANCE CHECKS
// ============================================

function checkPerformance(doc: Document, html: string): PerformanceData {
  const scripts = Array.from(doc.querySelectorAll('script[src]'));
  const headScripts = Array.from(doc.querySelectorAll('head script[src]')).filter(
    (s) => !s.hasAttribute('async') && !s.hasAttribute('defer')
  );
  const styles = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));

  // Preloads
  const preloads = Array.from(doc.querySelectorAll('link[rel="preload"]'));
  const preloadsWithoutAs = preloads.filter((link) => !link.getAttribute('as')).length;

  // Font-display check
  const fontFaces = html.match(/@font-face\s*{[^}]*}/gi) || [];
  const fontsWithoutDisplay = fontFaces.filter((ff) => !ff.includes('font-display')).length;

  return {
    totalScripts: scripts.length,
    totalStylesheets: styles.length,
    renderBlockingScripts: headScripts.length,
    renderBlockingStyles: styles.filter((s) => s.getAttribute('media') !== 'print').length,
    preloads: preloads.length,
    preloadsWithoutAs,
    preconnects: doc.querySelectorAll('link[rel="preconnect"]').length,
    prefetches: doc.querySelectorAll('link[rel="prefetch"]').length,
    dnsPrefetches: doc.querySelectorAll('link[rel="dns-prefetch"]').length,
    fontsWithoutDisplay,
  };
  }

  // ============================================
  // 10. SECURITY CHECKS
  // ============================================

  function checkSecurity(doc: Document, html: string, sourceUrl: string): SecurityData {
    const isHttps = sourceUrl?.startsWith('https://') || false;
    const mixedContentUrls: string[] = [];
    let protocolRelativeCount = 0;

    if (isHttps) {
      // Check images
      Array.from(doc.querySelectorAll('img[src]')).forEach((img) => {
        const src = img.getAttribute('src') || '';
      if (src.startsWith('http://')) {
        mixedContentUrls.push(src);
      }
      if (src.startsWith('//')) protocolRelativeCount++;
      });

        // Check scripts
        Array.from(doc.querySelectorAll('script[src]')).forEach((s) => {
          const src = s.getAttribute('src') || '';
          if (src.startsWith('http://')) mixedContentUrls.push(src);
            if (src.startsWith('//')) protocolRelativeCount++;
        });

          // Check stylesheets
          Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).forEach((l) => {
            const href = l.getAttribute('href') || '';
            if (href.startsWith('http://')) mixedContentUrls.push(href);
              if (href.startsWith('//')) protocolRelativeCount++;
          });
    }

    // Unsafe external links count (target="_blank" without noopener)
    const unsafeExternalLinks = Array.from(doc.querySelectorAll('a[target="_blank"]')).filter(
      (a) => !(a.getAttribute('rel') || '').includes('noopener')
    ).length;

    return {
      isHttps,
      mixedContentCount: mixedContentUrls.length,
      mixedContentUrls: mixedContentUrls.slice(0, 10),
      protocolRelativeCount,
      unsafeExternalLinks,
    };
  }

  // ============================================
  // 11. PLATFORM DETECTION
  // ============================================

  function detectPlatform(html: string, doc: Document): PlatformData {
    const lower = html.toLowerCase();
    const cms = PATTERNS.CMS.filter((c: { name: string; patterns: string[] }) => c.patterns.some((p: string) => lower.includes(p))).map((c: { name: string; patterns: string[] }) => c.name);
    const frameworks = PATTERNS.FRAMEWORKS.filter((f: { name: string; patterns: string[] }) => f.patterns.some((p: string) => lower.includes(p))).map(
      (f: { name: string; patterns: string[] }) => f.name
    );

    // Render method detection
    let renderMethod = 'Unknown';
    let isCSR = false;

    const bodyText = doc.body?.textContent || '';
    const hasSubstantialContent = bodyText.length > 500;
    const hasReactRoot =
    doc.querySelector('#root') || doc.querySelector('#__next') || doc.querySelector('#app');
    const hasEmptyRoot = hasReactRoot && (hasReactRoot.innerHTML?.trim().length || 0) < 50;

    if (lower.includes('__next_data__')) {
      renderMethod = 'Next.js SSR/SSG';
    } else if (lower.includes('__nuxt')) {
      renderMethod = 'Nuxt SSR/SSG';
    } else if (hasEmptyRoot || (!hasSubstantialContent && hasReactRoot)) {
      renderMethod = 'Client-Side Rendered (CSR)';
      isCSR = true;
    } else if (hasSubstantialContent) {
      renderMethod = 'Server-Side Rendered / Static';
    }

    return { cms, frameworks, renderMethod, isCSR };
  }

  // ============================================
  // 12. TRUST SIGNALS (E-E-A-T) CHECKS
  // ============================================

  function checkTrustSignals(doc: Document, schema: SchemaData): TrustSignalsData {
    const hrefs = Array.from(doc.querySelectorAll('a[href]')).map(
      (l) => l.getAttribute('href')?.toLowerCase() || ''
    );

    const socialPlatforms = PATTERNS.SOCIAL_PLATFORMS.filter((s: { name: string; pattern: string }) =>
    hrefs.some((h: string) => h.includes(s.pattern))
    ).map((s: { name: string; pattern: string }) => s.name);

    // Check for author information
    const hasAuthorSchema = schema.types.some((t) => t === 'Person') || schema.details.some((d) => d.type === 'Article' || d.type === 'BlogPosting');
    const hasAuthorMeta = !!doc.querySelector('meta[name="author"]')?.getAttribute('content');
    const hasAuthorElement = !!doc.querySelector('.author, [rel="author"], [itemprop="author"]');
    const hasAuthor = hasAuthorSchema || hasAuthorMeta || hasAuthorElement;

    return {
      hasAboutPage: hrefs.some(
        (h) => h.includes('/about') || h.includes('/ჩვენს-შესახებ') || h.includes('/team') || h.includes('/გუნდი')
      ),
      hasContactPage: hrefs.some(
        (h) => h.includes('/contact') || h.includes('/კონტაქტი')
      ),
      hasPrivacyPage: hrefs.some(
        (h) => h.includes('/privacy') || h.includes('/კონფიდენციალურობა') || h.includes('/პოლიტიკა')
      ),
      hasAuthor,
      socialLinksCount: socialPlatforms.length,
      socialPlatforms,
    };
  }

  // ============================================
  // COLLECT ALL ISSUES
  // ============================================

  function collectIssues(data: any): AuditIssue[] {
    const issues: AuditIssue[] = [];
    const {
      technical,
      international,
      content,
      links,
      images,
      schema,
      social,
      accessibility,
      performance,
      security,
      platform,
    } = data;

    // ========== TITLE ==========
    if (!technical.title.value) {
      issues.push({
        id: 'no-title',
        severity: 'critical',
        category: 'SEO',
        issue: 'Missing page title',
        issueGe: 'გვერდს არ აქვს სათაური',
        location: '<title>',
        fix: 'Add a unique, descriptive title (30-60 chars)',
                  fixGe: 'დაამატეთ უნიკალური სათაური (30-60 სიმბოლო)',
      });
    } else if (technical.title.length < 30) {
      issues.push({
        id: 'short-title',
        severity: 'high',
        category: 'SEO',
        issue: `Title too short (${technical.title.length} chars)`,
                  issueGe: `სათაური ძალიან მოკლეა (${technical.title.length} სიმბოლო)`,
                  location: '<title>',
                  fix: 'Expand to 30-60 characters',
                  fixGe: 'გააფართოვეთ 30-60 სიმბოლომდე',
                  current: technical.title.value,
      });
    } else if (technical.title.length > 60) {
      issues.push({
        id: 'long-title',
        severity: 'medium',
        category: 'SEO',
        issue: `Title may be truncated (${technical.title.length} chars)`,
                  issueGe: `სათაური შეიძლება შეიკვეცოს (${technical.title.length} სიმბოლო)`,
                  location: '<title>',
                  fix: 'Shorten to under 60 characters',
                  fixGe: 'შეამოკლეთ 60 სიმბოლომდე',
                  current: technical.title.value.substring(0, 60) + '...',
      });
    }

    // ========== META DESCRIPTION ==========
    if (!technical.metaDesc.value) {
      issues.push({
        id: 'no-meta-desc',
        severity: 'high',
        category: 'SEO',
        issue: 'Missing meta description',
        issueGe: 'მეტა აღწერა არ არის',
        location: '<meta name="description">',
        fix: 'Add meta description (120-160 chars)',
                  fixGe: 'დაამატეთ მეტა აღწერა (120-160 სიმბოლო)',
      });
    } else if (technical.metaDesc.length < 120) {
      issues.push({
        id: 'short-meta-desc',
        severity: 'medium',
        category: 'SEO',
        issue: `Meta description too short (${technical.metaDesc.length} chars)`,
                  issueGe: `მეტა აღწერა მოკლეა (${technical.metaDesc.length} სიმბოლო)`,
                  location: '<meta name="description">',
                  fix: 'Expand to 120-160 characters',
                  fixGe: 'გააფართოვეთ 120-160 სიმბოლომდე',
      });
    } else if (technical.metaDesc.length > 160) {
      issues.push({
        id: 'long-meta-desc',
        severity: 'low',
        category: 'SEO',
        issue: `Meta description may be truncated (${technical.metaDesc.length} chars)`,
                  issueGe: `მეტა აღწერა შეიძლება შეიკვეცოს (${technical.metaDesc.length} სიმბოლო)`,
                  location: '<meta name="description">',
                  fix: 'Keep under 160 characters',
                  fixGe: 'შეინარჩუნეთ 160 სიმბოლომდე',
      });
    }

    // ========== CANONICAL ==========
    if (!technical.canonical.href) {
      issues.push({
        id: 'no-canonical',
        severity: 'medium',
        category: 'SEO',
        issue: 'Missing canonical URL',
        issueGe: 'კანონიკური URL არ არის',
        location: '<link rel="canonical">',
        fix: 'Add canonical link to prevent duplicate content',
        fixGe: 'დაამატეთ კანონიკური ბმული',
      });
    } else if (technical.canonical.count > 1) {
      issues.push({
        id: 'multiple-canonical',
        severity: 'critical',
        category: 'SEO',
        issue: `Multiple canonical tags (${technical.canonical.count})`,
                  issueGe: `რამდენიმე კანონიკური ტეგი (${technical.canonical.count} ცალი)`,
                  location: '<head>',
                  fix: 'Keep only ONE canonical tag per page',
                  fixGe: 'დატოვეთ მხოლოდ ერთი კანონიკური ტეგი',
      });
    } else if (technical.canonical.isCrossDomain) {
      issues.push({
        id: 'cross-domain-canonical',
        severity: 'high',
        category: 'SEO',
        issue: 'Canonical points to different domain',
        issueGe: 'კანონიკური სხვა დომენზე მიუთითებს',
        location: '<link rel="canonical">',
        fix: 'Verify this is intentional (cross-domain canonical)',
                  fixGe: 'დარწმუნდით, რომ ეს განზრახ არის',
                  current: technical.canonical.href,
      });
    }

    // ========== ROBOTS ==========
    if (technical.robots.hasNoindex) {
      issues.push({
        id: 'noindex',
        severity: 'critical',
        category: 'SEO',
        issue: 'Page blocked from indexing (noindex)',
                  issueGe: 'გვერდი დაბლოკილია ინდექსაციისთვის (noindex)',
                  location: '<meta name="robots">',
                  fix: 'Remove noindex if page should appear in search',
                  fixGe: 'წაშალეთ noindex თუ გვერდი უნდა იყოს ძებნაში',
                  current: technical.robots.meta || '',
      });
    }

    if (technical.robots.hasNofollow) {
      issues.push({
        id: 'nofollow-meta',
        severity: 'medium',
        category: 'SEO',
        issue: 'Page links not followed (nofollow)',
                  issueGe: 'გვერდის ბმულები არ მიჰყვება (nofollow)',
                  location: '<meta name="robots">',
                  fix: 'Remove nofollow if you want links to pass PageRank',
                  fixGe: 'წაშალეთ nofollow თუ გინდათ ბმულები გადასცემდნენ ავტორიტეტს',
      });
    }

    // ========== VIEWPORT ==========
    if (!technical.viewport.content) {
      issues.push({
        id: 'no-viewport',
        severity: 'critical',
        category: 'მობილური',
        issue: 'Missing viewport meta tag',
        issueGe: 'viewport მეტა ტეგი არ არის',
        location: '<meta name="viewport">',
        fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
        fixGe: 'დაამატეთ viewport ტეგი მობილური თავსებადობისთვის',
      });
    } else if (!technical.viewport.isMobileOptimized) {
      issues.push({
        id: 'viewport-not-optimized',
        severity: 'high',
        category: 'მობილური',
        issue: 'Viewport may not be mobile-optimized',
        issueGe: 'Viewport არ არის მობილურზე ოპტიმიზირებული',
        location: '<meta name="viewport">',
        fix: 'Use width=device-width for responsive design',
        fixGe: 'გამოიყენეთ width=device-width რესპონსივისთვის',
        current: technical.viewport.content,
      });
    }

    // ========== CHARSET ==========
    if (!technical.charset) {
      issues.push({
        id: 'no-charset',
        severity: 'medium',
        category: 'ტექნიკური',
        issue: 'Missing charset declaration',
        issueGe: 'charset დეკლარაცია არ არის',
        location: '<head>',
        fix: 'Add <meta charset="UTF-8"> as first element in <head>',
        fixGe: 'დაამატეთ <meta charset="UTF-8">',
      });
    }

    // ========== LANGUAGE ==========
    if (!accessibility.hasLangAttribute) {
      issues.push({
        id: 'no-lang',
        severity: 'high',
        category: 'ხელმისაწვდომობა',
        issue: 'Missing lang attribute on <html>',
        issueGe: 'lang ატრიბუტი არ არის <html>-ზე',
        location: '<html>',
        fix: 'Add <html lang="ka"> or appropriate language',
        fixGe: 'დაამატეთ lang="ka" ან შესაბამისი ენა',
      });
    }

    // ========== H1 ==========
    if (content.headings.h1.length === 0) {
      issues.push({
        id: 'no-h1',
        severity: 'high',
        category: 'კონტენტი',
        issue: 'No H1 heading found',
        issueGe: 'H1 სათაური არ არის',
        location: '<h1>',
        fix: 'Add one H1 with main topic/keyword',
        fixGe: 'დაამატეთ ერთი H1 მთავარი საკვანძო სიტყვით',
      });
    } else if (content.headings.h1.length > 1) {
      issues.push({
        id: 'multiple-h1',
        severity: 'low',
        category: 'კონტენტი',
        issue: `Multiple H1 headings (${content.headings.h1.length})`,
                  issueGe: `რამდენიმე H1 სათაური (${content.headings.h1.length} ცალი)`,
                  location: '<h1>',
                  fix: 'Consider using one H1 for clearer focus',
                  fixGe: 'გამოიყენეთ ერთი H1 უკეთესი ფოკუსისთვის',
                  details: content.headings.h1.join(' | '),
      });
    }

    // ========== TITLE vs H1 DUPLICATE ==========
    if (content.titleH1Duplicate) {
      issues.push({
        id: 'title-h1-duplicate',
        severity: 'low',
        category: 'კონტენტი',
        issue: 'Title and H1 are identical',
        issueGe: 'სათაური და H1 იდენტურია',
        location: '<title> / <h1>',
        fix: 'Make H1 slightly different to target more keywords',
        fixGe: 'გააკეთეთ H1 ოდნავ განსხვავებული მეტი საკვანძო სიტყვებისთვის',
      });
    }

    // ========== HEADING HIERARCHY ==========
    if (accessibility.skippedHeadings.length > 0) {
      issues.push({
        id: 'skipped-headings',
        severity: 'medium',
        category: 'ხელმისაწვდომობა',
        issue: `Skipped heading levels: ${accessibility.skippedHeadings.join(', ')}`,
                  issueGe: `გამოტოვებული სათაურები: ${accessibility.skippedHeadings.join(', ')}`,
                  location: '<h1>-<h6>',
                  fix: 'Use sequential heading levels (H1 → H2 → H3)',
                  fixGe: 'გამოიყენეთ თანმიმდევრული სათაურები',
      });
    }

    // ========== CONTENT ==========
    if (content.wordCount < 300) {
      issues.push({
        id: 'thin-content',
        severity: 'high',
        category: 'კონტენტი',
        issue: `Thin content (${content.wordCount} words)`,
                  issueGe: `მცირე კონტენტი (${content.wordCount} სიტყვა)`,
                  location: '<body>',
                  fix: 'Add more comprehensive content (800+ words for articles)',
                  fixGe: 'დაამატეთ მეტი კონტენტი (800+ სიტყვა სტატიებისთვის)',
      });
    }

    if (content.duplicateParagraphs > 0) {
      issues.push({
        id: 'duplicate-paragraphs',
        severity: 'low',
        category: 'კონტენტი',
        issue: `${content.duplicateParagraphs} duplicate paragraph(s) detected`,
                  issueGe: `${content.duplicateParagraphs} დუბლირებული პარაგრაფი აღმოჩნდა`,
                  location: '<p>',
                  fix: 'Remove or rewrite duplicate content',
                  fixGe: 'წაშალეთ ან გადაწერეთ დუბლირებული კონტენტი',
      });
    }

    // ========== HREFLANG ==========
    if (international.hreflangs.length > 0) {
      if (!international.hasXDefault) {
        issues.push({
          id: 'no-x-default',
          severity: 'medium',
          category: 'საერთაშორისო',
          issue: 'Missing x-default hreflang',
          issueGe: 'x-default hreflang არ არის',
          location: '<head>',
          fix: 'Add <link rel="alternate" hreflang="x-default" href="...">',
          fixGe: 'დაამატეთ x-default hreflang ტეგი',
        });
      }

      if (!international.hasSelfReference) {
        issues.push({
          id: 'no-hreflang-self-ref',
          severity: 'high',
          category: 'საერთაშორისო',
          issue: 'Page does not reference itself in hreflang',
          issueGe: 'გვერდი არ მიუთითებს საკუთარ თავზე hreflang-ში',
          location: '<head>',
          fix: 'Add hreflang pointing to the current page URL',
          fixGe: 'დაამატეთ hreflang მიმდინარე გვერდის URL-ით',
        });
      }

      international.issues.forEach((issue: string, i: number) => {
        issues.push({
          id: `hreflang-issue-${i}`,
          severity: 'high',
          category: 'საერთაშორისო',
          issue: issue,
          issueGe: issue,
          location: '<head>',
          fix: 'Fix hreflang tag format',
          fixGe: 'გაასწორეთ hreflang ტეგის ფორმატი',
        });
      });
    }

    // ========== IMAGES ==========
    if (images.withoutAlt > 0) {
      issues.push({
        id: 'images-no-alt',
        severity: images.withoutAlt > 5 ? 'high' : 'medium',
        category: 'ხელმისაწვდომობა',
        issue: `${images.withoutAlt} image(s) missing alt attribute`,
                  issueGe: `${images.withoutAlt} სურათს არ აქვს alt ატრიბუტი`,
                  location: '<img>',
                  fix: 'Add descriptive alt text to all content images',
                  fixGe: 'დაამატეთ alt ტექსტი ყველა სურათს',
      });
    }

    if (images.withoutDimensions > 0) {
      issues.push({
        id: 'images-no-dimensions',
        severity: 'medium',
        category: 'სიჩქარე',
        issue: `${images.withoutDimensions} image(s) without explicit dimensions`,
                  issueGe: `${images.withoutDimensions} სურათს არ აქვს ზომები (width/height)`,
                  location: '<img>',
                  fix: 'Add width and height to prevent CLS',
                  fixGe: 'დაამატეთ width და height CLS თავიდან ასაცილებლად',
      });
    }

    if (images.lazyAboveFold > 0) {
      issues.push({
        id: 'lazy-above-fold',
        severity: 'medium',
        category: 'სიჩქარე',
        issue: `${images.lazyAboveFold} above-fold image(s) may be lazy loaded`,
                  issueGe: `${images.lazyAboveFold} ზედა სურათს აქვს lazy loading`,
                  location: '<img loading="lazy">',
                  fix: 'Remove loading="lazy" from first visible images (LCP impact)',
                  fixGe: 'წაშალეთ lazy loading პირველი სურათებიდან (LCP გავლენა)',
      });
    }

    if (images.clickableWithoutAlt > 0) {
      issues.push({
        id: 'clickable-img-no-alt',
        severity: 'medium',
        category: 'ხელმისაწვდომობა',
        issue: `${images.clickableWithoutAlt} clickable image(s) missing alt`,
                  issueGe: `${images.clickableWithoutAlt} დაკლიკებად სურათს არ აქვს alt`,
                  location: '<a><img></a>',
                  fix: 'Add alt to images inside links/buttons',
                  fixGe: 'დაამატეთ alt ბმულებში მყოფ სურათებს',
      });
    }

    // ========== LINKS ==========
    if (links.broken > 0) {
      issues.push({
        id: 'broken-links',
        severity: 'high',
        category: 'ბმულები',
        issue: `${links.broken} empty/placeholder link(s)`,
                  issueGe: `${links.broken} ცარიელი/პლეისჰოლდერ ბმული`,
                  location: '<a href>',
                  fix: 'Replace javascript:void(0) and # with real URLs',
                  fixGe: 'შეცვალეთ javascript:void(0) და # რეალური URL-ებით',
      });
    }

    if (links.genericAnchors > 0) {
      issues.push({
        id: 'generic-anchors',
        severity: 'medium',
        category: 'ბმულები',
        issue: `${links.genericAnchors} link(s) with generic anchor text`,
                  issueGe: `${links.genericAnchors} ბმულს აქვს ზოგადი ანკორ ტექსტი`,
                  location: '<a>',
                  fix: 'Use descriptive anchor text with keywords',
                  fixGe: 'გამოიყენეთ აღწერითი ანკორ ტექსტი',
      });
    }

    if (links.unsafeExternalCount > 0) {
      issues.push({
        id: 'unsafe-external-links',
        severity: 'medium',
        category: 'უსაფრთხოება',
        issue: `${links.unsafeExternalCount} external link(s) missing rel="noopener"`,
                  issueGe: `${links.unsafeExternalCount} გარე ბმულს აკლია rel="noopener"`,
                  location: '<a target="_blank">',
                  fix: 'Add rel="noopener noreferrer" to target="_blank" links',
                  fixGe: 'დაამატეთ rel="noopener noreferrer"',
      });
    }

    // ========== SOCIAL ==========
    if (!social.isComplete) {
      const missing = [];
      if (!social.og.title) missing.push('og:title');
      if (!social.og.description) missing.push('og:description');
      if (!social.og.image) missing.push('og:image');
      if (!social.og.url) missing.push('og:url');

      issues.push({
        id: 'incomplete-og',
        severity: 'medium',
        category: 'სოციალური',
        issue: `Missing Open Graph tags: ${missing.join(', ')}`,
                  issueGe: `აკლია Open Graph ტეგები: ${missing.join(', ')}`,
                  location: '<meta property="og:*">',
                  fix: 'Add complete OG tags for better social sharing',
                  fixGe: 'დაამატეთ სრული OG ტეგები სოციალურში გაზიარებისთვის',
      });
    }

    if (!social.twitter.card) {
      issues.push({
        id: 'no-twitter-card',
        severity: 'low',
        category: 'სოციალური',
        issue: 'Missing Twitter Card meta tags',
        issueGe: 'Twitter Card მეტა ტეგები არ არის',
        location: '<meta name="twitter:*">',
        fix: 'Add <meta name="twitter:card" content="summary_large_image">',
        fixGe: 'დაამატეთ Twitter Card ტეგები',
      });
    }

    // ========== SCHEMA ==========
    if (schema.count === 0) {
      issues.push({
        id: 'no-schema',
        severity: 'medium',
        category: 'SEO',
        issue: 'No structured data (Schema.org) found',
                  issueGe: 'სტრუქტურირებული მონაცემები (Schema.org) არ არის',
                  location: '<script type="application/ld+json">',
                  fix: 'Add relevant Schema.org markup',
                  fixGe: 'დაამატეთ Schema.org მარკაპი',
      });
    } else {
      if (schema.invalid > 0) {
        issues.push({
          id: 'invalid-schema-json',
          severity: 'critical',
          category: 'Schema',
          issue: `${schema.invalid} schema(s) have invalid JSON`,
                    issueGe: `${schema.invalid} სქემას აქვს არასწორი JSON`,
                    location: '<script type="application/ld+json">',
                    fix: 'Fix JSON syntax - validate at json-ld.org/playground',
                    fixGe: 'გაასწორეთ JSON სინტაქსი',
        });
      }

      if (schema.missingContext > 0) {
        issues.push({
          id: 'schema-missing-context',
          severity: 'high',
          category: 'Schema',
          issue: `${schema.missingContext} schema(s) missing @context`,
                    issueGe: `${schema.missingContext} სქემას აკლია @context`,
                    location: '<script type="application/ld+json">',
                    fix: 'Add "@context": "https://schema.org"',
                    fixGe: 'დაამატეთ "@context": "https://schema.org"',
        });
      }

      // Report schema-specific issues
      schema.details.forEach((s: SchemaItem) => {
        if (s.issues.length > 0 && s.type !== 'Invalid JSON') {
          issues.push({
            id: `schema-${s.index}-issues`,
            severity: 'high',
            category: 'Schema',
            issue: `${s.type} schema incomplete: ${s.issues.join(', ')}`,
                      issueGe: `${s.type} სქემა არასრულია: ${s.issues.join(', ')}`,
                      location: `Schema #${s.index}`,
                      fix: 'Add required fields for rich results',
                      fixGe: 'დაამატეთ საჭირო ველები rich results-ისთვის',
          });
        }
      });
    }

    // ========== ACCESSIBILITY ==========
    if (accessibility.buttonsWithoutLabel > 0) {
      issues.push({
        id: 'buttons-no-label',
        severity: 'medium',
        category: 'ხელმისაწვდომობა',
        issue: `${accessibility.buttonsWithoutLabel} button(s) missing accessible labels`,
                  issueGe: `${accessibility.buttonsWithoutLabel} ღილაკს არ აქვს ხელმისაწვდომი ლეიბლი`,
                  location: '<button>',
                  fix: 'Add aria-label or visible text',
                  fixGe: 'დაამატეთ aria-label ან ტექსტი',
      });
    }

    if (accessibility.inputsWithoutLabel > 0) {
      issues.push({
        id: 'inputs-no-label',
        severity: 'medium',
        category: 'ხელმისაწვდომობა',
        issue: `${accessibility.inputsWithoutLabel} form input(s) missing labels`,
                  issueGe: `${accessibility.inputsWithoutLabel} ველს არ აქვს ლეიბლი`,
                  location: '<input>',
                  fix: 'Add <label for="id"> or aria-label',
                  fixGe: 'დაამატეთ <label> ან aria-label',
      });
    }

    if (accessibility.linksWithoutText > 0) {
      issues.push({
        id: 'links-no-text',
        severity: 'medium',
        category: 'ხელმისაწვდომობა',
        issue: `${accessibility.linksWithoutText} link(s) have no discernible text`,
                  issueGe: `${accessibility.linksWithoutText} ბმულს არ აქვს ტექსტი`,
                  location: '<a>',
                  fix: 'Add text content or aria-label',
                  fixGe: 'დაამატეთ ტექსტი ან aria-label',
      });
    }

    if (accessibility.iframesWithoutTitle > 0) {
      issues.push({
        id: 'iframes-no-title',
        severity: 'low',
        category: 'ხელმისაწვდომობა',
        issue: `${accessibility.iframesWithoutTitle} iframe(s) missing title`,
                  issueGe: `${accessibility.iframesWithoutTitle} iframe-ს არ აქვს title`,
                  location: '<iframe>',
                  fix: 'Add title attribute describing content',
                  fixGe: 'დაამატეთ title ატრიბუტი',
      });
    }

    if (accessibility.positiveTabindex > 0) {
      issues.push({
        id: 'positive-tabindex',
        severity: 'low',
        category: 'ხელმისაწვდომობა',
        issue: `${accessibility.positiveTabindex} element(s) with positive tabindex`,
                  issueGe: `${accessibility.positiveTabindex} ელემენტს აქვს დადებითი tabindex`,
                  location: '[tabindex]',
                  fix: 'Use tabindex="0" or "-1" instead of positive values',
                  fixGe: 'გამოიყენეთ tabindex="0" ან "-1"',
      });
    }

    // ========== PERFORMANCE ==========
    if (performance.renderBlockingScripts > 3) {
      issues.push({
        id: 'render-blocking-scripts',
        severity: 'medium',
        category: 'სიჩქარე',
        issue: `${performance.renderBlockingScripts} render-blocking scripts in <head>`,
        issueGe: `${performance.renderBlockingScripts} რენდერის მბლოკავი სკრიპტი`,
        location: '<head> <script>',
        fix: 'Add async or defer, or move to end of body',
        fixGe: 'დაამატეთ async ან defer',
      });
    }

    if (performance.preloadsWithoutAs > 0) {
      issues.push({
        id: 'preload-no-as',
        severity: 'medium',
        category: 'სიჩქარე',
        issue: `${performance.preloadsWithoutAs} preload link(s) missing "as" attribute`,
                  issueGe: `${performance.preloadsWithoutAs} preload-ს აკლია "as" ატრიბუტი`,
                  location: '<link rel="preload">',
                  fix: 'Add as="font", as="style", as="script", etc.',
                  fixGe: 'დაამატეთ as ატრიბუტი',
      });
    }

    if (performance.fontsWithoutDisplay > 0) {
      issues.push({
        id: 'fonts-no-display',
        severity: 'low',
        category: 'სიჩქარე',
        issue: `${performance.fontsWithoutDisplay} @font-face rule(s) missing font-display`,
                  issueGe: `${performance.fontsWithoutDisplay} @font-face-ს აკლია font-display`,
                  location: '@font-face',
                  fix: 'Add font-display: swap to prevent FOIT',
                  fixGe: 'დაამატეთ font-display: swap',
      });
    }

    // ========== SECURITY ==========
    if (security.mixedContentCount > 0) {
      issues.push({
        id: 'mixed-content',
        severity: 'critical',
        category: 'უსაფრთხოება',
        issue: `${security.mixedContentCount} HTTP resource(s) on HTTPS page`,
                  issueGe: `${security.mixedContentCount} HTTP რესურსი HTTPS გვერდზე`,
                  location: '<img>, <script>, <link>',
                  fix: 'Change all resources to HTTPS',
                  fixGe: 'შეცვალეთ ყველა რესურსი HTTPS-ით',
                  details: security.mixedContentUrls.slice(0, 3).join(', '),
      });
    }

    if (security.protocolRelativeCount > 0) {
      issues.push({
        id: 'protocol-relative',
        severity: 'low',
        category: 'ტექნიკური',
        issue: `${security.protocolRelativeCount} protocol-relative URL(s) found`,
                  issueGe: `${security.protocolRelativeCount} პროტოკოლ-რელატიური URL`,
                  location: 'src="//"',
                  fix: 'Use explicit https:// for clarity',
                  fixGe: 'გამოიყენეთ https:// ცხადად',
      });
    }

    // ========== PLATFORM ==========
    if (platform.isCSR) {
      issues.push({
        id: 'csr-detected',
        severity: 'high',
        category: 'ტექნიკური',
        issue: 'Page appears to be Client-Side Rendered (CSR)',
                  issueGe: 'გვერდი Client-Side Rendered (CSR) ჩანს',
                  location: '<body>',
                  fix: 'Consider SSR or Static Generation for SEO',
                  fixGe: 'გამოიყენეთ SSR ან Static Generation SEO-სთვის',
      });
    }

    // ========== FAVICON ==========
    if (!technical.favicon) {
      issues.push({
        id: 'no-favicon',
        severity: 'low',
        category: 'ტექნიკური',
        issue: 'No favicon detected',
        issueGe: 'Favicon არ არის',
        location: '<head>',
        fix: 'Add <link rel="icon" href="/favicon.ico">',
        fixGe: 'დაამატეთ favicon',
      });
    }

    return issues;
  }

  // ============================================
  // COLLECT PASSED CHECKS
  // ============================================

  function collectPassed(data: any): string[] {
    const passed: string[] = [];
    const {
      technical,
      international,
      content,
      links,
      images,
      schema,
      social,
      accessibility,
      performance,
      security,
      trustSignals,
    } = data;

    // Title
    if (technical.title.isOptimal) passed.push('სათაური ოპტიმალურია ✓');

    // Meta description
    if (technical.metaDesc.isOptimal) passed.push('მეტა აღწერა ოპტიმალურია ✓');

    // H1
    if (content.headings.h1.length === 1) passed.push('ერთი H1 სათაური ✓');

    // Content
    if (content.wordCount >= 300) passed.push(`კარგი კონტენტი (${content.wordCount} სიტყვა) ✓`);

    // Images
    if (images.withoutAlt === 0 && images.total > 0) passed.push('ყველა სურათს აქვს alt ✓');
    if (images.withoutDimensions === 0 && images.total > 0) passed.push('სურათებს აქვთ ზომები ✓');

    // Links
    if (links.broken === 0) passed.push('გატეხილი ბმულები არ არის ✓');

    // Schema
    if (schema.count > 0 && schema.invalid === 0) {
      passed.push(`Schema.org (${schema.types.join(', ')}) ✓`);
    }

    // Social
    if (social.isComplete) passed.push('Open Graph ტეგები სრულია ✓');
    if (social.twitter.card) passed.push('Twitter Card ✓');

    // Technical
    if (accessibility.hasLangAttribute) passed.push(`ენა: ${technical.language} ✓`);
    if (technical.canonical.href && technical.canonical.count === 1 && !technical.canonical.isCrossDomain) {
      passed.push('კანონიკური URL ✓');
    }
    if (technical.viewport.isMobileOptimized) passed.push('Viewport მობილურზე ✓');
    if (technical.favicon) passed.push('Favicon ✓');
    if (technical.appleTouchIcon) passed.push('Apple Touch Icon ✓');
    if (technical.charset) passed.push('Charset დეკლარაცია ✓');

    // Hreflang
    if (international.hreflangs.length > 0 && international.hasXDefault && international.hasSelfReference) {
      passed.push(`Hreflang ტეგები (${international.hreflangs.length} ენა) ✓`);
    }

    // Security
    if (security.isHttps) passed.push('HTTPS ✓');
    if (security.mixedContentCount === 0 && security.isHttps) passed.push('Mixed content არ არის ✓');

    // Performance
    if (performance.preconnects > 0) passed.push(`Preconnect (${performance.preconnects}) ✓`);
    if (performance.preloads > 0) passed.push(`Preload (${performance.preloads}) ✓`);

    // Accessibility
    if (accessibility.hasSkipLink) passed.push('Skip link ✓');
    if (accessibility.buttonsWithoutLabel === 0 && accessibility.inputsWithoutLabel === 0) {
      passed.push('ფორმები ხელმისაწვდომია ✓');
    }

    // Trust signals
    if (trustSignals.hasAboutPage) passed.push('ჩვენს შესახებ გვერდი ✓');
    if (trustSignals.hasContactPage) passed.push('კონტაქტის გვერდი ✓');
    if (trustSignals.hasPrivacyPage) passed.push('კონფიდენციალურობის გვერდი ✓');
    if (trustSignals.hasAuthor) passed.push('ავტორის ინფორმაცია ✓');
    if (trustSignals.socialLinksCount > 0) {
      passed.push(`სოც. ქსელები (${trustSignals.socialPlatforms.join(', ')}) ✓`);
    }

    return passed;
  }

  // ============================================
  // CALCULATE SCORE
  // ============================================

  function calculateScore(issues: AuditIssue[], passed: string[]): number {
    let score = 100;

    issues.forEach((i) => {
      switch (i.severity) {
        case 'critical':
          score -= 15;
          break;
        case 'high':
          score -= 8;
          break;
        case 'medium':
          score -= 4;
          break;
        case 'low':
          score -= 1;
          break;
      }
    });

    // Bonus for passed checks
    score += Math.min(10, passed.length * 0.5);

    return Math.max(0, Math.min(100, Math.round(score)));
  }
