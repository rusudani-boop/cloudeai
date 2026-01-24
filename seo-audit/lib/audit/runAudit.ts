// lib/audit/runAudit.ts
import { JSDOM } from 'jsdom';
import { PATTERNS } from '../checks/patterns';
import type {
  AuditResult,
  AuditIssue,
  SchemaItem,
  HreflangTag,
  ReadabilityData,
  AriaData,
  DOMData,
} from './types';

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

export async function runAudit(
  html: string,
  sourceUrl: string,
  options?: { robotsTxt?: string | null; sitemapFound?: boolean; llmsTxtFound?: boolean }
): Promise<AuditResult> {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const htmlLower = html.toLowerCase();

  const technical = analyzeTechnical(doc, sourceUrl, htmlLower, options);
  const international = analyzeInternational(doc, sourceUrl, technical.canonical.href, technical.language);
  const content = analyzeContent(doc, htmlLower, technical.title.value);
  const links = analyzeLinks(doc, sourceUrl);
  const images = analyzeImages(doc);
  const schema = analyzeSchema(doc);
  const social = analyzeSocial(doc);
  const accessibility = analyzeAccessibility(doc, htmlLower);
  const domData = analyzeDom(doc, html);
  const performance = analyzePerformance(doc, html, htmlLower);
  const security = analyzeSecurity(doc, sourceUrl, htmlLower);
  const platform = analyzePlatform(htmlLower);
  const trustSignals = analyzeTrustSignals(doc, schema);

  const issues = collectIssues({ technical, international, content, links, images, schema, social, accessibility, dom: domData, performance, security, platform });
  const passed = collectPassed({ technical, international, content, links, images, schema, social, accessibility, dom: domData, performance, security, platform, trustSignals });
  const score = calculateScore(issues, passed);

  // Calculate actual checks performed (issues found + passed + base neutral checks)
  // Base checks: items that are checked but may not appear in issues or passed (like optional hreflang)
  const baseChecks = 15; // robots.txt, sitemap, performance metrics, security headers, etc.
  const totalChecks = issues.length + passed.length + baseChecks;

  return {
    url: sourceUrl,
    score,
    timestamp: new Date().toISOString(),
    fetchMethod: 'html',
    summary: {
      criticalIssues: issues.filter((i) => i.severity === 'critical').length,
      highIssues: issues.filter((i) => i.severity === 'high').length,
      mediumIssues: issues.filter((i) => i.severity === 'medium').length,
      lowIssues: issues.filter((i) => i.severity === 'low').length,
      totalChecks,
      passedChecks: passed.length,
    },
    technical, international, content, links, images, schema, social, accessibility, dom: domData, performance, security, platform, trustSignals, issues, passed,
  };
}

// ============================================
// FLESCH READING SCORE (Multi-language support)
// ============================================

// Detect primary language of text
function detectLanguage(text: string): 'ka' | 'ru' | 'de' | 'en' {
  const sample = text.substring(0, 2000);

  // Count Georgian characters (უნიკოდი: U+10A0 - U+10FF)
  const georgianChars = (sample.match(/[\u10A0-\u10FF]/g) || []).length;

  // Count Cyrillic characters (Russian: U+0400 - U+04FF)
  const cyrillicChars = (sample.match(/[\u0400-\u04FF]/g) || []).length;

  // Count German-specific characters and common German words
  const germanUmlauts = (sample.match(/[äöüÄÖÜß]/g) || []).length;
  const germanWords = (sample.toLowerCase().match(/\b(und|der|die|das|ist|sind|haben|werden|nicht|auch|für|mit|auf|dem|des|ein|eine|zu|von|bei|nach|über|vor|durch|unter|gegen|ohne|seit|während|wegen)\b/g) || []).length;

  // Count Latin characters
  const latinChars = (sample.match(/[a-zA-Z]/g) || []).length;

  const total = georgianChars + cyrillicChars + latinChars;
  if (total < 50) return 'en'; // Default to English if not enough text

  // Georgian takes priority if significant presence
  if (georgianChars > total * 0.3) return 'ka';

  // Russian/Cyrillic
  if (cyrillicChars > total * 0.3) return 'ru';

  // German detection: umlauts OR common German words
  if (germanUmlauts > 3 || germanWords > 5) return 'de';

  return 'en';
}

// Count syllables based on detected language
function countSyllables(word: string, lang: 'ka' | 'ru' | 'de' | 'en'): number {
  word = word.toLowerCase();

  if (lang === 'ka') {
    // Georgian vowels: ა, ე, ი, ო, უ
    const vowels = word.match(/[აეიოუ]/g);
    return vowels ? Math.max(1, vowels.length) : 1;
  }

  if (lang === 'ru') {
    // Russian vowels: а, е, ё, и, о, у, ы, э, ю, я
    const vowels = word.match(/[аеёиоуыэюя]/g);
    return vowels ? Math.max(1, vowels.length) : 1;
  }

  if (lang === 'de') {
    // German vowels including umlauts
    const cleanWord = word.replace(/[^a-zäöüß]/g, '');
    if (!cleanWord) return 1;
    // German diphthongs count as 1 syllable: ei, ie, eu, äu, au
    let processed = cleanWord.replace(/ei|ie|eu|äu|au/g, 'X');
    const vowels = processed.match(/[aeiouäöüX]/g);
    return vowels ? Math.max(1, vowels.length) : 1;
  }

  // English syllable counting
  const englishWord = word.replace(/[^a-z]/g, '');
  if (!englishWord || englishWord.length <= 3) return 1;
  const cleaned = englishWord.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const syllables = cleaned.match(/[aeiouy]{1,2}/g);
  return syllables ? Math.max(1, syllables.length) : 1;
}

function calculateReadability(text: string): ReadabilityData {
  // Clean the text - remove extra whitespace and non-content
  const cleanText = text.replace(/\s+/g, ' ').trim();

  // Detect language first
  const lang = detectLanguage(cleanText);

  // Split sentences - handle various punctuation
  const sentences = cleanText.split(/[.!?։।;]+/).filter((s) => s.trim().length > 10);
  const totalSentences = Math.max(sentences.length, 1);

  // Get words - filter out very short tokens
  const words = cleanText.split(/\s+/).filter((w) => w.replace(/[^\p{L}]/gu, '').length >= 2);
  const totalWords = words.length;

  if (totalWords < 10) {
    return {
      fleschScore: 0,
      fleschGrade: 'არასაკმარისი კონტენტი',
      avgSentenceLength: 0,
      avgSyllablesPerWord: 0,
      complexWordPercentage: 0
    };
  }

  let totalSyllables = 0, complexWords = 0;
  words.forEach((word) => {
    const syllables = countSyllables(word, lang);
    totalSyllables += syllables;
    if (syllables >= 3) complexWords++;
  });

  const avgSentenceLength = totalWords / totalSentences;
  const avgSyllablesPerWord = totalWords > 0 ? totalSyllables / totalWords : 0;
  const complexWordPercentage = totalWords > 0 ? (complexWords / totalWords) * 100 : 0;

  // Language-specific Flesch formulas
  let fleschScore: number;
  if (lang === 'de') {
    // German Flesch formula (Amstad)
    fleschScore = 180 - avgSentenceLength - (58.5 * avgSyllablesPerWord);
  } else if (lang === 'ka' || lang === 'ru') {
    // Adapted formula for Georgian/Russian (syllable-based languages)
    // These languages have more syllables per word on average
    fleschScore = 206.835 - (1.3 * avgSentenceLength) - (60.1 * avgSyllablesPerWord);
  } else {
    // English Flesch formula
    fleschScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  }

  // Clamp to 0-100 range
  fleschScore = Math.max(0, Math.min(100, fleschScore));

  let fleschGrade: string;
  if (fleschScore >= 90) fleschGrade = 'ძალიან მარტივი (5 კლასი)';
  else if (fleschScore >= 80) fleschGrade = 'მარტივი (6 კლასი)';
  else if (fleschScore >= 70) fleschGrade = 'საკმაოდ მარტივი (7 კლასი)';
  else if (fleschScore >= 60) fleschGrade = 'სტანდარტული (8-9 კლასი)';
  else if (fleschScore >= 50) fleschGrade = 'საკმაოდ რთული (10-12 კლასი)';
  else if (fleschScore >= 30) fleschGrade = 'რთული (კოლეჯი)';
  else fleschGrade = 'ძალიან რთული (უნივერსიტეტი)';

  return {
    fleschScore: Math.round(fleschScore * 10) / 10,
    fleschGrade,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    complexWordPercentage: Math.round(complexWordPercentage * 10) / 10
  };
}

// ============================================
// DOM ANALYSIS
// ============================================

function analyzeDom(doc: Document, html: string): DOMData {
  const allElements = doc.querySelectorAll('*');
  const totalElements = allElements.length;

  let maxDepth = 0, totalDepth = 0;
  function getDepth(el: Element): number {
    let depth = 0, current: Element | null = el;
    while (current?.parentElement) { depth++; current = current.parentElement; }
    return depth;
  }
  allElements.forEach((el) => { const d = getDepth(el); totalDepth += d; if (d > maxDepth) maxDepth = d; });

  let textNodes = 0, commentNodes = 0;
  const walker = doc.createTreeWalker(doc.body || doc, 0xFFFFFFFF);
  let node: Node | null;
  while ((node = walker.nextNode())) { if (node.nodeType === 3) textNodes++; else if (node.nodeType === 8) commentNodes++; }

  const inlineStyles = doc.querySelectorAll('[style]').length;
  const inlineScripts = doc.querySelectorAll('script:not([src])').length;
  const emptyElements = Array.from(doc.querySelectorAll('p, div, span, li')).filter((el) => !el.textContent?.trim() && !el.querySelector('img, video, iframe, svg')).length;

  const deprecatedElements: string[] = [];
  PATTERNS.DEPRECATED_ELEMENTS.forEach((tag) => { if (doc.querySelector(tag)) deprecatedElements.push(tag); });

  const ids = Array.from(doc.querySelectorAll('[id]')).map((el) => el.id);
  const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i && id);

  const elementCounts: Record<string, number> = {};
  allElements.forEach((el) => { const tag = el.tagName.toLowerCase(); elementCounts[tag] = (elementCounts[tag] || 0) + 1; });

  return { totalElements, maxDepth, averageDepth: totalElements > 0 ? Math.round((totalDepth / totalElements) * 10) / 10 : 0, totalNodes: doc.body?.childNodes.length || 0, textNodes, commentNodes, inlineStyles, inlineScripts, emptyElements, deprecatedElements: [...new Set(deprecatedElements)], duplicateIds: [...new Set(duplicateIds)], elementCounts };
}

// ============================================
// ARIA ANALYSIS
// ============================================

function analyzeAria(doc: Document): AriaData {
  const landmarks = {
    main: doc.querySelectorAll('main, [role="main"]').length,
    nav: doc.querySelectorAll('nav, [role="navigation"]').length,
    header: doc.querySelectorAll('header, [role="banner"]').length,
    footer: doc.querySelectorAll('footer, [role="contentinfo"]').length,
    aside: doc.querySelectorAll('aside, [role="complementary"]').length,
    search: doc.querySelectorAll('[role="search"]').length,
    form: doc.querySelectorAll('form, [role="form"]').length,
    region: doc.querySelectorAll('[role="region"]').length,
  };

  const roles = [...new Set(Array.from(doc.querySelectorAll('[role]')).map((el) => el.getAttribute('role') || '').filter(Boolean))];
  const missingLandmarks: string[] = [];
  if (landmarks.main === 0) missingLandmarks.push('main');
  if (landmarks.nav === 0) missingLandmarks.push('navigation');
  if (landmarks.header === 0) missingLandmarks.push('banner/header');

  return {
    landmarks,
    ariaLabels: doc.querySelectorAll('[aria-label]').length,
    ariaDescribedby: doc.querySelectorAll('[aria-describedby]').length,
    ariaLabelledby: doc.querySelectorAll('[aria-labelledby]').length,
    ariaHidden: doc.querySelectorAll('[aria-hidden="true"]').length,
    ariaLive: doc.querySelectorAll('[aria-live]').length,
    ariaExpanded: doc.querySelectorAll('[aria-expanded]').length,
    roles, missingLandmarks,
  };
}

// ============================================
// TECHNICAL ANALYSIS
// ============================================

function analyzeTechnical(doc: Document, sourceUrl: string, htmlLower: string, options?: { robotsTxt?: string | null; sitemapFound?: boolean; llmsTxtFound?: boolean }) {
  const title = doc.querySelector('title')?.textContent?.trim() || '';
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
  const canonicals = doc.querySelectorAll('link[rel="canonical"]');
  const canonicalHref = canonicals[0]?.getAttribute('href') || null;
  let isCrossDomain = false;
  if (canonicalHref && sourceUrl) { try { isCrossDomain = new URL(canonicalHref).hostname !== new URL(sourceUrl).hostname; } catch {} }

  const robotsMeta = doc.querySelector('meta[name="robots"]')?.getAttribute('content')?.toLowerCase() || null;
  const googlebotMeta = doc.querySelector('meta[name="googlebot"]')?.getAttribute('content')?.toLowerCase() || '';
  const viewport = doc.querySelector('meta[name="viewport"]')?.getAttribute('content') || null;
  const charset = doc.querySelector('meta[charset]')?.getAttribute('charset') || doc.querySelector('meta[http-equiv="Content-Type"]')?.getAttribute('content') || null;
  const language = doc.documentElement?.getAttribute('lang') || null;
  const robotsTxt = options?.robotsTxt;

  return {
    title: { value: title, length: title.length, isOptimal: title.length >= 30 && title.length <= 60 },
    metaDesc: { value: metaDesc, length: metaDesc.length, isOptimal: metaDesc.length >= 120 && metaDesc.length <= 160 },
    canonical: { href: canonicalHref, count: canonicals.length, isCrossDomain },
    robots: { meta: robotsMeta, hasNoindex: (robotsMeta?.includes('noindex') || googlebotMeta.includes('noindex')) ?? false, hasNofollow: robotsMeta?.includes('nofollow') ?? false, xRobotsTag: null },
    robotsTxt: { found: !!robotsTxt, content: robotsTxt?.substring(0, 500) || null, blocksAll: robotsTxt ? /disallow:\s*\/\s*$/im.test(robotsTxt) : false, hasSitemap: robotsTxt ? /sitemap:/i.test(robotsTxt) : false },
    sitemap: { found: options?.sitemapFound ?? false, url: null },
    llmsTxt: { found: options?.llmsTxtFound ?? false, mentioned: htmlLower.includes('llms.txt') || htmlLower.includes('llms-txt') },
    language, charset,
    viewport: { content: viewport, isMobileOptimized: viewport?.includes('width=device-width') ?? false },
    favicon: !!doc.querySelector('link[rel*="icon"]'),
    appleTouchIcon: !!doc.querySelector('link[rel="apple-touch-icon"]'),
    manifestJson: !!doc.querySelector('link[rel="manifest"]'),
    themeColor: doc.querySelector('meta[name="theme-color"]')?.getAttribute('content') || null,
  };
}

// ============================================
// INTERNATIONAL (HREFLANG)
// ============================================

function analyzeInternational(doc: Document, sourceUrl: string, canonicalHref: string | null, htmlLang: string | null) {
  const hreflangs: HreflangTag[] = Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]')).map((link) => ({ hreflang: link.getAttribute('hreflang') || '', href: link.getAttribute('href') || '' }));
  const hasXDefault = hreflangs.some((h) => h.hreflang === 'x-default');
  const sourceUrlNormalized = sourceUrl?.toLowerCase().replace(/\/$/, '') || '';
  const hasSelfReference = hreflangs.some((h) => h.href?.toLowerCase().replace(/\/$/, '') === sourceUrlNormalized);
  const canonicalNormalized = canonicalHref?.toLowerCase().replace(/\/$/, '') || '';
  const canonicalInHreflang = !canonicalHref || hreflangs.some((h) => h.href?.toLowerCase().replace(/\/$/, '') === canonicalNormalized);

  let langMatchesHreflang = true;
  if (htmlLang && hreflangs.length > 0) {
    const langCode = htmlLang.toLowerCase().split('-')[0];
    langMatchesHreflang = hreflangs.some((h) => h.hreflang?.toLowerCase().split('-')[0] === langCode || h.hreflang === 'x-default');
  }

  const issues: string[] = [];
  hreflangs.forEach((h, i) => {
    if (h.href && !h.href.startsWith('http')) issues.push(`Hreflang #${i + 1}: Relative URL`);
    if (h.hreflang && h.hreflang !== 'x-default' && h.hreflang.includes('-')) {
      const parts = h.hreflang.split('-');
      if (parts.length === 2 && parts[1] !== parts[1].toUpperCase()) issues.push(`Hreflang #${i + 1}: Region should be uppercase`);
    }
  });

  return { hreflangs, hasXDefault, hasSelfReference, canonicalInHreflang, langMatchesHreflang, issues };
}

// ============================================
// CONTENT ANALYSIS
// ============================================

function getReadableText(doc: Document): string {
  // Clone body to avoid modifying original
  const clone = doc.body?.cloneNode(true) as HTMLElement;
  if (!clone) return '';

  // Remove non-content elements
  const removeSelectors = ['script', 'style', 'noscript', 'template', 'svg', 'code', 'pre', 'iframe', '[hidden]', '[aria-hidden="true"]'];
  removeSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  // Get text and clean it
  let text = clone.textContent || '';
  // Remove excessive whitespace
  text = text.replace(/\s+/g, ' ').trim();
  // Remove common non-content patterns
  text = text.replace(/\{[^}]*\}/g, ''); // Remove JSON-like content
  text = text.replace(/function\s*\([^)]*\)/g, ''); // Remove function signatures

  return text;
}

function analyzeContent(doc: Document, htmlLower: string, title: string) {
  const headings = {
    h1: Array.from(doc.querySelectorAll('h1')).map((h) => h.textContent?.trim() || ''),
    h2: Array.from(doc.querySelectorAll('h2')).map((h) => h.textContent?.trim() || ''),
    h3: Array.from(doc.querySelectorAll('h3')).map((h) => h.textContent?.trim() || ''),
    h4: Array.from(doc.querySelectorAll('h4')).map((h) => h.textContent?.trim() || ''),
    h5: Array.from(doc.querySelectorAll('h5')).map((h) => h.textContent?.trim() || ''),
    h6: Array.from(doc.querySelectorAll('h6')).map((h) => h.textContent?.trim() || ''),
  };

  // Get clean readable text (excluding scripts, styles, etc.)
  const bodyText = getReadableText(doc);
  const words = bodyText.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  const characterCount = bodyText.length;
  const sentences = bodyText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const paragraphs = doc.querySelectorAll('p');
  const readingTime = Math.ceil(wordCount / 200);
  const titleH1Duplicate = title.toLowerCase().trim() === (headings.h1[0]?.toLowerCase().trim() || '') && title.length > 0;

  const paragraphTexts = Array.from(paragraphs).map((p) => p.textContent?.trim() || '').filter((t) => t.length > 50);
  const duplicateParagraphs = paragraphTexts.filter((t, i, arr) => arr.indexOf(t) !== i).length;

  const bodyTextLower = bodyText.toLowerCase();
  let aiScore = 0;
  const aiPhrases: string[] = [];
  PATTERNS.AI_PHRASES.forEach((phrase) => {
    const regex = new RegExp(phrase, 'gi');
    const matches = bodyTextLower.match(regex);
    if (matches) { aiScore += matches.length * 5; aiPhrases.push(`"${phrase}" (${matches.length}x)`); }
  });
  aiScore = Math.min(aiScore, 100);

  const readability = calculateReadability(bodyText);

  const wordFreq: Record<string, number> = {};
  words.forEach((w) => {
    const word = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (word.length > 3 && !PATTERNS.STOP_WORDS.has(word)) wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  const keywordDensity = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count, percentage: Math.round((count / wordCount) * 10000) / 100 }));

  return { headings, wordCount, characterCount, sentenceCount: sentences.length, paragraphCount: paragraphs.length, readingTime, titleH1Duplicate, duplicateParagraphs, aiScore, aiPhrases, readability, keywordDensity };
}

// ============================================
// LINK ANALYSIS
// ============================================

function analyzeLinks(doc: Document, sourceUrl: string) {
  const links = Array.from(doc.querySelectorAll('a[href]'));
  const sourceHost = sourceUrl ? new URL(sourceUrl).hostname : '';

  let internal = 0, external = 0, broken = 0, genericAnchors = 0, nofollow = 0, sponsored = 0, ugc = 0, unsafeExternalCount = 0;
  const brokenList: { href: string; text: string }[] = [];
  const genericAnchorsList: { text: string; href: string }[] = [];

  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const text = a.textContent?.trim().toLowerCase() || '';
    const rel = a.getAttribute('rel') || '';

    if (PATTERNS.EMPTY_HREFS.includes(href)) { broken++; brokenList.push({ href: href || '(empty)', text: text.substring(0, 50) }); }
    if (href.startsWith('http')) { try { if (new URL(href).hostname === sourceHost) internal++; else external++; } catch {} }
    else if (href.startsWith('/') || href.startsWith('./') || (!href.includes(':') && href)) internal++;
    if (PATTERNS.GENERIC_ANCHORS.includes(text)) { genericAnchors++; genericAnchorsList.push({ text, href: href.substring(0, 50) }); }
    if (rel.includes('nofollow')) nofollow++;
    if (rel.includes('sponsored')) sponsored++;
    if (rel.includes('ugc')) ugc++;
    if (a.getAttribute('target') === '_blank' && !rel.includes('noopener')) unsafeExternalCount++;
  });

  return { total: links.length, internal, external, broken, brokenList: brokenList.slice(0, 10), genericAnchors, genericAnchorsList: genericAnchorsList.slice(0, 10), nofollow, sponsored, ugc, unsafeExternalCount, hasFooterLinks: !!doc.querySelector('footer a'), hasNavLinks: !!doc.querySelector('nav a') };
}

// ============================================
// IMAGE ANALYSIS
// ============================================

function analyzeImages(doc: Document) {
  const images = Array.from(doc.querySelectorAll('img'));
  const withoutAlt = images.filter((img) => !img.hasAttribute('alt')).length;
  const withEmptyAlt = images.filter((img) => img.getAttribute('alt') === '').length;
  const withoutDimensions = images.filter((img) => !img.hasAttribute('width') || !img.hasAttribute('height')).length;
  const lazyLoaded = images.filter((img) => img.getAttribute('loading') === 'lazy').length;
  const lazyAboveFold = images.slice(0, 3).filter((img) => img.getAttribute('loading') === 'lazy').length;
  const clickableWithoutAlt = images.filter((img) => { const p = img.parentElement; return (p?.tagName === 'A' || p?.tagName === 'BUTTON') && !img.getAttribute('alt'); }).length;
  const srcsetCount = images.filter((img) => img.hasAttribute('srcset')).length;
  const modernFormats = images.filter((img) => { const src = img.getAttribute('src') || ''; return src.includes('.webp') || src.includes('.avif'); }).length;

  return { total: images.length, withoutAlt, withEmptyAlt, withoutDimensions, lazyLoaded, lazyAboveFold, clickableWithoutAlt, decorativeCount: withEmptyAlt, largeImages: images.length - srcsetCount, modernFormats, srcsetCount };
}

// ============================================
// SCHEMA ANALYSIS
// ============================================

function analyzeSchema(doc: Document) {
  const schemaScripts = doc.querySelectorAll('script[type="application/ld+json"]');
  const schemas: SchemaItem[] = [];
  const types: string[] = [];
  let invalid = 0, missingContext = 0;

  schemaScripts.forEach((script, index) => {
    try {
      const data = JSON.parse(script.textContent || '');
      const items = Array.isArray(data) ? data : [data];
      items.forEach((item, itemIndex) => {
        const type = item['@type'] || 'Unknown';
        types.push(type);
        const schemaIssues: string[] = [];
        if (!item['@context']) { missingContext++; schemaIssues.push('Missing @context'); }
        const requirements = PATTERNS.SCHEMA_REQUIREMENTS[type];
        if (requirements?.required) requirements.required.forEach((field) => { if (!item[field]) schemaIssues.push(`Missing: ${field}`); });
        if (requirements?.needsOneOf && !requirements.needsOneOf.some((f) => item[f])) schemaIssues.push(`Needs one of: ${requirements.needsOneOf.join(', ')}`);
        schemas.push({ index: `${index + 1}${items.length > 1 ? `.${itemIndex + 1}` : ''}`, type, valid: schemaIssues.length === 0, issues: schemaIssues });
      });
    } catch { invalid++; schemas.push({ index: `${index + 1}`, type: 'Invalid JSON', valid: false, issues: ['Invalid JSON syntax'] }); }
  });

  return { count: schemas.length, types: [...new Set(types)], valid: schemas.filter((s) => s.valid).length, invalid, details: schemas, missingContext, hasWebSiteSearch: types.includes('WebSite'), hasBreadcrumb: types.includes('BreadcrumbList'), hasOrganization: types.includes('Organization') || types.includes('LocalBusiness'), hasFAQ: types.includes('FAQPage'), hasHowTo: types.includes('HowTo') };
}

// ============================================
// SOCIAL ANALYSIS
// ============================================

function analyzeSocial(doc: Document) {
  const og = {
    title: doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || null,
    description: doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || null,
    image: doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || null,
    url: doc.querySelector('meta[property="og:url"]')?.getAttribute('content') || null,
    type: doc.querySelector('meta[property="og:type"]')?.getAttribute('content') || null,
    siteName: doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || null,
    locale: doc.querySelector('meta[property="og:locale"]')?.getAttribute('content') || null,
  };
  const twitter = {
    card: doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || null,
    site: doc.querySelector('meta[name="twitter:site"]')?.getAttribute('content') || null,
    creator: doc.querySelector('meta[name="twitter:creator"]')?.getAttribute('content') || null,
    title: doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || null,
    description: doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || null,
    image: doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || null,
  };
  return { og, twitter, isComplete: !!(og.title && og.description && og.image && og.url), hasArticleTags: !!(doc.querySelector('meta[property="article:published_time"]') || doc.querySelector('meta[property="article:author"]')) };
}

// ============================================
// ACCESSIBILITY ANALYSIS
// ============================================

function analyzeAccessibility(doc: Document, htmlLower: string) {
  const aria = analyzeAria(doc);
  const buttonsWithoutLabel = Array.from(doc.querySelectorAll('button')).filter((btn) => !btn.textContent?.trim() && !btn.getAttribute('aria-label') && !btn.getAttribute('aria-labelledby') && !btn.getAttribute('title')).length;
  const inputsWithoutLabel = Array.from(doc.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')).filter((input) => { const id = input.getAttribute('id'); return !id || !doc.querySelector(`label[for="${id}"]`) && !input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby') && !input.getAttribute('placeholder'); }).length;
  const linksWithoutText = Array.from(doc.querySelectorAll('a')).filter((a) => !a.textContent?.trim() && !a.getAttribute('aria-label') && !a.querySelector('img[alt]') && !a.getAttribute('title')).length;
  const iframesWithoutTitle = Array.from(doc.querySelectorAll('iframe')).filter((iframe) => !iframe.getAttribute('title')).length;

  const headingLevels = [1, 2, 3, 4, 5, 6].filter((level) => doc.querySelector(`h${level}`));
  const skippedHeadings: string[] = [];
  for (let i = 1; i < headingLevels.length; i++) { if (headingLevels[i] - headingLevels[i - 1] > 1) skippedHeadings.push(`H${headingLevels[i - 1]} → H${headingLevels[i]}`); }

  const hasSkipLink = !!(doc.querySelector('a[href="#main"]') || doc.querySelector('a[href="#content"]') || doc.querySelector('.skip-link') || doc.querySelector('[class*="skip"]'));
  const positiveTabindex = Array.from(doc.querySelectorAll('[tabindex]')).filter((el) => parseInt(el.getAttribute('tabindex') || '0', 10) > 0).length;
  const tablesWithoutHeaders = Array.from(doc.querySelectorAll('table')).filter((table) => !table.querySelector('th')).length;
  const autoplayMedia = doc.querySelectorAll('video[autoplay], audio[autoplay]').length;

  return { buttonsWithoutLabel, inputsWithoutLabel, linksWithoutText, iframesWithoutTitle, skippedHeadings, hasSkipLink, hasLangAttribute: !!doc.documentElement?.getAttribute('lang'), clickableImagesWithoutAlt: 0, positiveTabindex, hasMainLandmark: aria.landmarks.main > 0, hasNavLandmark: aria.landmarks.nav > 0, hasFocusVisible: htmlLower.includes(':focus-visible') || htmlLower.includes('focus-visible'), colorContrastIssues: 0, aria, tablesWithoutHeaders, autoplayMedia };
}

// ============================================
// PERFORMANCE ANALYSIS
// ============================================

function analyzePerformance(doc: Document, html: string, htmlLower: string) {
  const scripts = doc.querySelectorAll('script');
  const stylesheets = doc.querySelectorAll('link[rel="stylesheet"]');
  const headScripts = doc.querySelectorAll('head script[src]');
  const renderBlockingScripts = Array.from(headScripts).filter((s) => !s.hasAttribute('async') && !s.hasAttribute('defer')).length;
  const preloads = doc.querySelectorAll('link[rel="preload"]');
  const preloadsWithoutAs = Array.from(preloads).filter((link) => !link.getAttribute('as')).length;
  const fontFaces = html.match(/@font-face\s*\{[^}]*\}/gi) || [];
  const fontsWithoutDisplay = fontFaces.filter((ff) => !ff.includes('font-display')).length;
  const htmlSize = new Blob([html]).size;
  const estimatedWeight = htmlSize > 1000000 ? `${(htmlSize / 1000000).toFixed(2)} MB` : `${(htmlSize / 1000).toFixed(2)} KB`;

  return {
    totalScripts: scripts.length, totalStylesheets: stylesheets.length, renderBlockingScripts, renderBlockingStyles: stylesheets.length,
    asyncScripts: doc.querySelectorAll('script[async]').length, deferScripts: doc.querySelectorAll('script[defer]').length, moduleScripts: doc.querySelectorAll('script[type="module"]').length,
    inlineScripts: doc.querySelectorAll('script:not([src])').length, inlineStyles: doc.querySelectorAll('style').length,
    preloads: preloads.length, preloadsWithoutAs, preconnects: doc.querySelectorAll('link[rel="preconnect"]').length, prefetches: doc.querySelectorAll('link[rel="prefetch"]').length, dnsPrefetches: doc.querySelectorAll('link[rel="dns-prefetch"]').length,
    fontsWithoutDisplay, webFonts: doc.querySelectorAll('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').length,
    criticalCssInlined: doc.querySelectorAll('style').length > 0, hasServiceWorker: htmlLower.includes('serviceworker') || htmlLower.includes('service-worker'), htmlSize, estimatedWeight,
  };
}

// ============================================
// SECURITY ANALYSIS
// ============================================

function analyzeSecurity(doc: Document, sourceUrl: string, htmlLower: string) {
  const isHttps = sourceUrl?.startsWith('https://') ?? false;
  const mixedContentUrls: string[] = [];
  if (isHttps) doc.querySelectorAll('img[src^="http://"], script[src^="http://"], link[href^="http://"]').forEach((el) => { mixedContentUrls.push(el.getAttribute('src') || el.getAttribute('href') || ''); });

  return {
    isHttps, mixedContentCount: mixedContentUrls.length, mixedContentUrls: mixedContentUrls.slice(0, 5), protocolRelativeCount: doc.querySelectorAll('[src^="//"], [href^="//"]').length, unsafeExternalLinks: 0,
    hasCSP: htmlLower.includes('content-security-policy'), hasXFrameOptions: false, hasXContentTypeOptions: false, hasReferrerPolicy: !!doc.querySelector('meta[name="referrer"]'), hasCORS: false,
    formWithoutAction: doc.querySelectorAll('form:not([action])').length, passwordFieldWithoutAutocomplete: doc.querySelectorAll('input[type="password"]:not([autocomplete])').length,
  };
}

// ============================================
// PLATFORM DETECTION
// ============================================

function analyzePlatform(htmlLower: string) {
  const cms: string[] = [], frameworks: string[] = [], analytics: string[] = [], advertising: string[] = [];
  PATTERNS.CMS.forEach((c) => { if (c.patterns.some((p) => htmlLower.includes(p.toLowerCase()))) cms.push(c.name); });
  PATTERNS.FRAMEWORKS.forEach((f) => { if (f.patterns.some((p) => htmlLower.includes(p.toLowerCase()))) frameworks.push(f.name); });
  PATTERNS.ANALYTICS.forEach((a) => { if (a.patterns.some((p) => htmlLower.includes(p.toLowerCase()))) analytics.push(a.name); });
  PATTERNS.ADVERTISING.forEach((a) => { if (a.patterns.some((p) => htmlLower.includes(p.toLowerCase()))) advertising.push(a.name); });

  const hasReactRoot = htmlLower.includes('#root') || htmlLower.includes('#app') || htmlLower.includes('__next');
  const hasSubstantialContent = htmlLower.length > 5000;
  const isCSR = hasReactRoot && !hasSubstantialContent;

  return { cms: [...new Set(cms)], frameworks: [...new Set(frameworks)], analytics: [...new Set(analytics)], advertising: [...new Set(advertising)], renderMethod: isCSR ? 'Client-Side Rendered (CSR)' : 'Server-Side Rendered (SSR)', isCSR, isPWA: htmlLower.includes('manifest.json') || htmlLower.includes('serviceworker'), hasAMP: htmlLower.includes('⚡') || htmlLower.includes('amp-') || htmlLower.includes('amphtml') };
}

// ============================================
// TRUST SIGNALS
// ============================================

function analyzeTrustSignals(doc: Document, schema: any) {
  const allLinks = Array.from(doc.querySelectorAll('a[href]'));
  const hrefs = allLinks.map((a) => (a.getAttribute('href') || '').toLowerCase());
  const texts = allLinks.map((a) => (a.textContent || '').toLowerCase());
  const bodyText = doc.body?.textContent?.toLowerCase() || '';
  const htmlLower = doc.documentElement?.outerHTML?.toLowerCase() || '';

  const hasAboutPage = hrefs.some((h) => h.includes('about') || h.includes('შესახებ')) || texts.some((t) => t.includes('about') || t.includes('შესახებ'));
  const hasContactPage = hrefs.some((h) => h.includes('contact') || h.includes('კონტაქტ')) || texts.some((t) => t.includes('contact') || t.includes('კონტაქტ'));
  const hasPrivacyPage = hrefs.some((h) => h.includes('privacy') || h.includes('კონფიდენციალ')) || texts.some((t) => t.includes('privacy') || t.includes('კონფიდენციალ'));
  const hasTermsPage = hrefs.some((h) => PATTERNS.TRUST_PATTERNS.terms.some((p) => h.includes(p)));
  const hasCookiePolicy = hrefs.some((h) => PATTERNS.TRUST_PATTERNS.cookie.some((p) => h.includes(p)));
  const hasAuthor = !!(doc.querySelector('[rel="author"]') || doc.querySelector('.author') || doc.querySelector('[itemprop="author"]') || doc.querySelector('meta[name="author"]'));
  const hasPublishDate = !!(doc.querySelector('time[datetime]') || doc.querySelector('[itemprop="datePublished"]') || doc.querySelector('meta[property="article:published_time"]'));
  const hasModifiedDate = !!(doc.querySelector('[itemprop="dateModified"]') || doc.querySelector('meta[property="article:modified_time"]'));
  const hasCopyright = bodyText.includes('©') || bodyText.includes('copyright');
  const hasAddress = !!(doc.querySelector('address') || doc.querySelector('[itemprop="address"]'));
  const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(bodyText);
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(bodyText);

  const socialPlatforms: string[] = [];
  PATTERNS.SOCIAL_PLATFORMS.forEach((sp) => { if (hrefs.some((h) => h.includes(sp.pattern))) socialPlatforms.push(sp.name); });

  return { hasAboutPage, hasContactPage, hasPrivacyPage, hasTermsPage, hasCookiePolicy, hasAuthor, hasPublishDate, hasModifiedDate, hasCopyright, hasAddress, hasPhone, hasEmail, socialLinksCount: socialPlatforms.length, socialPlatforms: [...new Set(socialPlatforms)], hasSSLBadge: PATTERNS.TRUST_PATTERNS.ssl.some((p) => htmlLower.includes(p)), hasPaymentBadges: PATTERNS.TRUST_PATTERNS.payment.some((p) => htmlLower.includes(p)), hasReviews: PATTERNS.TRUST_PATTERNS.review.some((p) => htmlLower.includes(p)), hasCertifications: PATTERNS.TRUST_PATTERNS.certification.some((p) => htmlLower.includes(p)) };
}

// ============================================
// COLLECT ISSUES
// ============================================

// Severity phrases in Georgian
const SEVERITY_PHRASES = {
  critical: 'კრიტიკული! დაუყოვნებლივ გამოსწორება საჭირო.',
  high: 'მაღალი პრიორიტეტი! SEO-ზე მნიშვნელოვნად მოქმედებს.',
  medium: 'საშუალო პრიორიტეტი. რეკომენდებულია გამოსწორება.',
  low: 'დაბალი პრიორიტეტი. სასურველია გამოსწორება.'
};

function collectIssues(data: any): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const { technical, international, content, links, images, schema, social, accessibility, dom, performance, security, platform } = data;

  // Title - CRITICAL for SEO
  if (!technical.title.value) issues.push({ id: 'no-title', severity: 'critical', category: 'ტექნიკური', issue: 'Missing title tag', issueGe: 'სათაური არ არის', location: '<head>', fix: 'Add <title>Your Page Title</title> in <head>', fixGe: 'დაამატეთ <title>თქვენი სათაური</title> <head>-ში', details: `${SEVERITY_PHRASES.critical} Title tag არის SEO-ს ყველაზე მნიშვნელოვანი ელემენტი. Google იყენებს მას ძიების შედეგებში. მის გარეშე გვერდი ვერ დარანჟირდება სათანადოდ.` });
  else if (technical.title.length < 30) issues.push({ id: 'title-short', severity: 'high', category: 'ტექნიკური', issue: `Title too short (${technical.title.length} chars)`, issueGe: `სათაური ძალიან მოკლეა (${technical.title.length} სიმბოლო)`, location: '<title>', fix: 'Expand to 30-60 characters with keywords', fixGe: 'გააგრძელეთ 30-60 სიმბოლომდე საკვანძო სიტყვებით', details: `${SEVERITY_PHRASES.high} მიმდინარე: "${technical.title.value}". მოკლე სათაური კარგავს რანჟირების პოტენციალს. დაამატეთ საკვანძო სიტყვები.` });
  else if (technical.title.length > 60) issues.push({ id: 'title-long', severity: 'medium', category: 'ტექნიკური', issue: `Title may be truncated (${technical.title.length} chars)`, issueGe: `სათაური შეიკვეცება (${technical.title.length} სიმბოლო)`, location: '<title>', fix: 'Keep important keywords in first 60 chars', fixGe: 'მთავარი სიტყვები განათავსეთ პირველ 60 სიმბოლოში', details: `${SEVERITY_PHRASES.medium} მიმდინარე: "${technical.title.value.substring(0, 70)}...". Google აჩვენებს მაქსიმუმ 60 სიმბოლოს.` });

  // Meta description - Important for CTR
  if (!technical.metaDesc.value) issues.push({ id: 'no-meta-desc', severity: 'high', category: 'ტექნიკური', issue: 'Missing meta description', issueGe: 'მეტა აღწერა არ არის', location: '<head>', fix: 'Add <meta name="description" content="...">', fixGe: 'დაამატეთ <meta name="description" content="აღწერა">', details: `${SEVERITY_PHRASES.high} Meta description გავლენას ახდენს CTR-ზე (Click-Through Rate). მის გარეშე Google თავად აირჩევს ტექსტს გვერდიდან, რაც შეიძლება არ იყოს ოპტიმალური.` });
  else if (technical.metaDesc.length < 120) issues.push({ id: 'meta-desc-short', severity: 'medium', category: 'ტექნიკური', issue: `Meta description short (${technical.metaDesc.length} chars)`, issueGe: `მეტა აღწერა მოკლეა (${technical.metaDesc.length} სიმბოლო)`, location: '<meta name="description">', fix: 'Expand to 120-160 chars with call-to-action', fixGe: 'გააგრძელეთ 120-160 სიმბოლომდე მოწოდებით', details: `${SEVERITY_PHRASES.medium} მიმდინარე: "${technical.metaDesc.value}". მოკლე აღწერა ვერ იზიდავს მომხმარებელს. დაამატეთ სარგებელი და მოწოდება (CTA).` });
  else if (technical.metaDesc.length > 160) issues.push({ id: 'meta-desc-long', severity: 'low', category: 'ტექნიკური', issue: `Meta description truncated (${technical.metaDesc.length} chars)`, issueGe: `მეტა აღწერა შეიკვეცება (${technical.metaDesc.length} სიმბოლო)`, location: '<meta name="description">', fix: 'Keep under 160 chars', fixGe: 'შეამოკლეთ 160 სიმბოლომდე', details: `${SEVERITY_PHRASES.low} Google შეკვეცს 160+ სიმბოლოს "..." -ით. მთავარი ინფორმაცია დასაწყისში განათავსეთ.` });

  // Canonical
  if (technical.canonical.count === 0) issues.push({ id: 'no-canonical', severity: 'medium', category: 'ტექნიკური', issue: 'Missing canonical tag', issueGe: 'Canonical ტეგი არ არის', location: '<head>', fix: 'Add <link rel="canonical" href="...">', fixGe: 'დაამატეთ canonical ტეგი', details: `${SEVERITY_PHRASES.medium} Canonical ტეგი ეუბნება Google-ს რომელია გვერდის მთავარი ვერსია. ეს ხელს უშლის დუბლირებული კონტენტის პრობლემას.` });
  else if (technical.canonical.count > 1) issues.push({ id: 'multi-canonical', severity: 'critical', category: 'ტექნიკური', issue: `Multiple canonicals found (${technical.canonical.count})`, issueGe: `რამდენიმე canonical (${technical.canonical.count} ცალი)`, location: '<head>', fix: 'Keep only one canonical tag', fixGe: 'დატოვეთ მხოლოდ ერთი canonical', details: `${SEVERITY_PHRASES.critical} რამდენიმე canonical ტეგი აბნევს Google-ს. გვერდზე უნდა იყოს მხოლოდ ერთი canonical.` });
  else if (technical.canonical.isCrossDomain) issues.push({ id: 'cross-domain-canonical', severity: 'high', category: 'ტექნიკური', issue: 'Cross-domain canonical detected', issueGe: 'სხვა დომენზე canonical', location: '<link rel="canonical">', fix: 'Verify this is intentional', fixGe: 'დარწმუნდით რომ განზრახ არის', details: `${SEVERITY_PHRASES.high} Canonical მიუთითებს სხვა დომენზე: ${technical.canonical.href}. ეს ნიშნავს რომ Google ამ გვერდს არ დაარანჟირებს.` });

  // Viewport
  if (!technical.viewport.content) issues.push({ id: 'no-viewport', severity: 'critical', category: 'მობილური', issue: 'Missing viewport meta tag', issueGe: 'Viewport მეტა ტეგი არ არის', location: '<head>', fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">', fixGe: 'დაამატეთ viewport მეტა ტეგი', details: `${SEVERITY_PHRASES.critical} Viewport აუცილებელია მობილური მოწყობილობებისთვის. მის გარეშე გვერდი არასწორად გამოჩნდება მობილურზე და Google-ის Mobile-First ინდექსაცია დაზარალდება.` });
  else if (!technical.viewport.isMobileOptimized) issues.push({ id: 'viewport-not-mobile', severity: 'high', category: 'მობილური', issue: 'Viewport not mobile-optimized', issueGe: 'Viewport არაა მობილურზე ოპტიმიზებული', location: '<meta name="viewport">', fix: 'Use width=device-width, initial-scale=1', fixGe: 'გამოიყენეთ width=device-width', details: `${SEVERITY_PHRASES.high} მიმდინარე viewport: "${technical.viewport.content}". უნდა შეიცავდეს width=device-width.` });

  // Language & Charset
  if (!technical.language) issues.push({ id: 'no-lang', severity: 'high', category: 'ხელმისაწვდომობა', issue: 'Missing lang attribute on <html>', issueGe: 'lang ატრიბუტი არ არის', location: '<html>', fix: 'Add lang="ka" or appropriate language code', fixGe: 'დაამატეთ lang="ka" ან შესაბამისი კოდი', details: `${SEVERITY_PHRASES.high} lang ატრიბუტი ეხმარება ბრაუზერს და სკრინრიდერებს ენის განსაზღვრაში. ასევე მნიშვნელოვანია საერთაშორისო SEO-სთვის.` });
  if (!technical.charset) issues.push({ id: 'no-charset', severity: 'medium', category: 'ტექნიკური', issue: 'Missing charset declaration', issueGe: 'Charset დეკლარაცია არ არის', location: '<head>', fix: 'Add <meta charset="UTF-8">', fixGe: 'დაამატეთ <meta charset="UTF-8">', details: `${SEVERITY_PHRASES.medium} Charset განსაზღვრავს სიმბოლოების კოდირებას. UTF-8 საჭიროა ქართული და სხვა უნიკოდ სიმბოლოებისთვის.` });

  // Robots
  if (technical.robots.hasNoindex) issues.push({ id: 'noindex', severity: 'critical', category: 'ტექნიკური', issue: 'Page blocked from indexing (noindex)', issueGe: 'გვერდი დაბლოკილია ინდექსაციისთვის', location: '<meta name="robots">', fix: 'Remove noindex if page should be indexed', fixGe: 'წაშალეთ noindex თუ გვერდი უნდა დაინდექსდეს', details: `${SEVERITY_PHRASES.critical} noindex მეტა ტეგი ბლოკავს გვერდის ინდექსაციას Google-ში. გვერდი არ გამოჩნდება ძიების შედეგებში!` });

  // llms.txt
  if (!technical.llmsTxt.found && !technical.llmsTxt.mentioned) issues.push({ id: 'no-llms-txt', severity: 'low', category: 'AI', issue: 'No llms.txt file found', issueGe: 'llms.txt ფაილი არ არის', location: '/llms.txt', fix: 'Create llms.txt for AI crawler guidance', fixGe: 'შექმენით llms.txt AI კროულერებისთვის', details: `${SEVERITY_PHRASES.low} llms.txt არის ახალი სტანდარტი AI კროულერებისთვის (ChatGPT, Claude და ა.შ.). მისი დამატება ეხმარება AI სისტემებს თქვენი საიტის უკეთ გაგებაში.` });

  // Headings
  if (content.headings.h1.length === 0) issues.push({ id: 'no-h1', severity: 'high', category: 'კონტენტი', issue: 'No H1 heading found', issueGe: 'H1 სათაური არ არის', location: '<h1>', fix: 'Add one H1 heading describing page content', fixGe: 'დაამატეთ ერთი H1 სათაური', details: `${SEVERITY_PHRASES.high} H1 არის გვერდის მთავარი სათაური. ყოველ გვერდს უნდა ჰქონდეს ზუსტად ერთი H1, რომელიც აღწერს გვერდის შინაარსს.` });
  else if (content.headings.h1.length > 1) issues.push({ id: 'multi-h1', severity: 'low', category: 'კონტენტი', issue: `Multiple H1 headings (${content.headings.h1.length})`, issueGe: `რამდენიმე H1 სათაური (${content.headings.h1.length})`, location: '<h1>', fix: 'Use only one H1, use H2-H6 for subheadings', fixGe: 'გამოიყენეთ ერთი H1, დანარჩენისთვის H2-H6', details: `${SEVERITY_PHRASES.low} ნაპოვნი H1-ები: ${content.headings.h1.slice(0, 3).map((h: string) => `"${h.substring(0, 40)}"`).join(', ')}. რეკომენდებულია ერთი H1.` });
  if (content.titleH1Duplicate) issues.push({ id: 'title-h1-same', severity: 'low', category: 'კონტენტი', issue: 'Title and H1 are identical', issueGe: 'Title და H1 იდენტურია', location: '<title>/<h1>', fix: 'Make H1 slightly different from title', fixGe: 'გააკეთეთ H1 განსხვავებული სათაურისგან', details: `${SEVERITY_PHRASES.low} Title და H1 ერთნაირია: "${technical.title.value}". სხვადასხვა ტექსტი იძლევა მეტ საკვანძო სიტყვას.` });
  if (accessibility.skippedHeadings.length > 0) issues.push({ id: 'skipped-headings', severity: 'medium', category: 'ხელმისაწვდომობა', issue: `Heading levels skipped: ${accessibility.skippedHeadings.join(', ')}`, issueGe: `სათაურის დონეები გამოტოვებულია`, location: '<h1>-<h6>', fix: 'Use sequential heading levels (H1→H2→H3)', fixGe: 'გამოიყენეთ თანმიმდევრული დონეები', details: `${SEVERITY_PHRASES.medium} გამოტოვებული დონეები: ${accessibility.skippedHeadings.join(', ')}. სათაურები უნდა იყოს თანმიმდევრული (H1→H2→H3) სკრინრიდერებისთვის.` });

  // Content & Readability
  if (content.wordCount < 300) issues.push({ id: 'thin-content', severity: 'high', category: 'კონტენტი', issue: `Thin content (${content.wordCount} words)`, issueGe: `მცირე კონტენტი (${content.wordCount} სიტყვა)`, location: '<body>', fix: 'Add more valuable content (300+ words recommended)', fixGe: 'დაამატეთ მეტი კონტენტი (300+ სიტყვა)', details: `${SEVERITY_PHRASES.high} გვერდზე მხოლოდ ${content.wordCount} სიტყვაა. Google უპირატესობას ანიჭებს დეტალურ, ყოვლისმომცველ კონტენტს.` });
  if (content.readability.fleschScore > 0 && content.readability.fleschScore < 30) issues.push({ id: 'hard-to-read', severity: 'medium', category: 'კონტენტი', issue: `Hard to read (Flesch: ${content.readability.fleschScore})`, issueGe: `რთული წასაკითხი (Flesch: ${content.readability.fleschScore})`, location: '<body>', fix: 'Use shorter sentences and simpler words', fixGe: 'გამოიყენეთ მოკლე წინადადებები', details: `${SEVERITY_PHRASES.medium} Flesch ქულა: ${content.readability.fleschScore}/100 (${content.readability.fleschGrade}). საშუალო წინადადების სიგრძე: ${content.readability.avgSentenceLength} სიტყვა. გაამარტივეთ ტექსტი.` });
  if (content.aiScore > 50) issues.push({ id: 'ai-content', severity: 'medium', category: 'კონტენტი', issue: `Possible AI-generated content (Score: ${content.aiScore})`, issueGe: `შესაძლო AI კონტენტი (ქულა: ${content.aiScore})`, location: '<body>', fix: 'Humanize content, add personal insights', fixGe: 'გააადამიანურეთ კონტენტი', details: `${SEVERITY_PHRASES.medium} ნაპოვნი AI ფრაზები: ${content.aiPhrases.slice(0, 5).join(', ')}. Google ამცირებს AI-გენერირებული კონტენტის რანჟირებას.` });

  // Hreflang
  if (international.hreflangs.length > 0) {
    if (!international.hasXDefault) issues.push({ id: 'no-x-default', severity: 'medium', category: 'საერთაშორისო', issue: 'Missing hreflang x-default', issueGe: 'x-default hreflang არ არის', location: '<head>', fix: 'Add <link rel="alternate" hreflang="x-default" href="...">', fixGe: 'დაამატეთ x-default hreflang', details: `${SEVERITY_PHRASES.medium} x-default მიუთითებს ნაგულისხმევ გვერდს იმ მომხმარებლებისთვის, ვისი ენაც არ არის სიაში.` });
    if (!international.hasSelfReference) issues.push({ id: 'no-self-hreflang', severity: 'high', category: 'საერთაშორისო', issue: 'Missing self-referencing hreflang', issueGe: 'თვით-მიმთითებელი hreflang არ არის', location: '<head>', fix: 'Add hreflang pointing to current page', fixGe: 'დაამატეთ hreflang მიმდინარე გვერდზე', details: `${SEVERITY_PHRASES.high} ყველა hreflang სეტი უნდა შეიცავდეს თვით-მიმთითებელ ბმულს მიმდინარე გვერდზე.` });
    if (!international.canonicalInHreflang) issues.push({ id: 'canonical-not-in-hreflang', severity: 'high', category: 'საერთაშორისო', issue: 'Canonical URL missing from hreflang set', issueGe: 'Canonical არ არის hreflang-ში', location: '<head>', fix: 'Add canonical URL to hreflang set', fixGe: 'ჩართეთ canonical URL hreflang-ში', details: `${SEVERITY_PHRASES.high} Canonical URL უნდა იყოს hreflang სეტში.` });
    if (!international.langMatchesHreflang) issues.push({ id: 'lang-mismatch', severity: 'medium', category: 'საერთაშორისო', issue: 'HTML lang not matching hreflang', issueGe: 'HTML lang არ ემთხვევა hreflang-ს', location: '<html lang>', fix: 'Ensure lang attribute matches a hreflang', fixGe: 'შეასწორეთ lang ატრიბუტი', details: `${SEVERITY_PHRASES.medium} HTML-ის lang="${technical.language}" არ ემთხვევა არცერთ hreflang მნიშვნელობას.` });
    international.issues.forEach((issue: string, i: number) => issues.push({ id: `hreflang-${i}`, severity: 'high', category: 'საერთაშორისო', issue, issueGe: issue, location: '<head>', fix: 'Fix hreflang configuration', fixGe: 'გაასწორეთ hreflang', details: `${SEVERITY_PHRASES.high} ${issue}` }));
  }

  // Images
  if (images.withoutAlt > 0) issues.push({ id: 'img-no-alt', severity: images.withoutAlt > 5 ? 'high' : 'medium', category: 'ხელმისაწვდომობა', issue: `${images.withoutAlt} image(s) missing alt text`, issueGe: `${images.withoutAlt} სურათს არ აქვს alt ტექსტი`, location: '<img>', fix: 'Add descriptive alt text to all images', fixGe: 'დაამატეთ აღწერითი alt ტექსტი', details: `${images.withoutAlt > 5 ? SEVERITY_PHRASES.high : SEVERITY_PHRASES.medium} ${images.withoutAlt} სურათს აკლია alt ატრიბუტი. Alt ტექსტი აუცილებელია ხელმისაწვდომობისთვის და სურათების SEO-სთვის.` });
  if (images.withoutDimensions > 0) issues.push({ id: 'img-no-dim', severity: 'medium', category: 'სიჩქარე', issue: `${images.withoutDimensions} image(s) without dimensions`, issueGe: `${images.withoutDimensions} სურათს არ აქვს ზომები`, location: '<img>', fix: 'Add width and height attributes', fixGe: 'დაამატეთ width და height ატრიბუტები', details: `${SEVERITY_PHRASES.medium} სურათების ზომების მითითება ხელს უშლის CLS (Cumulative Layout Shift) პრობლემას და აუმჯობესებს Core Web Vitals.` });
  if (images.lazyAboveFold > 0) issues.push({ id: 'lazy-above-fold', severity: 'medium', category: 'სიჩქარე', issue: `${images.lazyAboveFold} above-fold image(s) with lazy loading`, issueGe: `${images.lazyAboveFold} ზედა სურათს აქვს lazy loading`, location: '<img loading="lazy">', fix: 'Remove lazy loading from above-fold images', fixGe: 'წაშალეთ lazy loading ზედა სურათებიდან', details: `${SEVERITY_PHRASES.medium} პირველი 1-3 სურათი (above-fold) არ უნდა იყოს lazy-loaded, რადგან ეს ანელებს LCP-ს (Largest Contentful Paint).` });

  // Links
  if (links.broken > 0) issues.push({ id: 'broken-links', severity: 'high', category: 'ბმულები', issue: `${links.broken} empty/invalid link(s) found`, issueGe: `${links.broken} ცარიელი/არასწორი ბმული`, location: '<a href="">', fix: 'Add valid href URLs or remove links', fixGe: 'დაამატეთ სწორი URL ან წაშალეთ ბმული', details: `${SEVERITY_PHRASES.high} ნაპოვნი პრობლემური ბმულები: ${links.brokenList.slice(0, 5).map((l: any) => `"${l.text || '(empty)'}" → ${l.href}`).join('; ')}. ცარიელი href ან javascript:void(0) აუარესებს UX-ს.` });
  if (links.genericAnchors > 0) issues.push({ id: 'generic-anchors', severity: 'medium', category: 'ბმულები', issue: `${links.genericAnchors} link(s) with generic anchor text`, issueGe: `${links.genericAnchors} ბმულს აქვს ზოგადი ანკორი`, location: '<a>click here</a>', fix: 'Use descriptive anchor text', fixGe: 'გამოიყენეთ აღწერითი ანკორ ტექსტი', details: `${SEVERITY_PHRASES.medium} ნაპოვნი ზოგადი ანკორები: ${links.genericAnchorsList.slice(0, 5).map((l: any) => `"${l.text}"`).join(', ')}. "click here", "more" არ აძლევს Google-ს კონტექსტს.` });
  if (links.unsafeExternalCount > 0) issues.push({ id: 'unsafe-external', severity: 'medium', category: 'უსაფრთხოება', issue: `${links.unsafeExternalCount} external link(s) missing rel="noopener"`, issueGe: `${links.unsafeExternalCount} გარე ბმულს აკლია noopener`, location: '<a target="_blank">', fix: 'Add rel="noopener noreferrer" to external links', fixGe: 'დაამატეთ rel="noopener noreferrer"', details: `${SEVERITY_PHRASES.medium} target="_blank" ბმულებს სჭირდებათ rel="noopener" უსაფრთხოებისთვის (Tabnabbing თავდასხმის პრევენცია).` });

  // Schema
  if (schema.count === 0) issues.push({ id: 'no-schema', severity: 'medium', category: 'SEO', issue: 'No structured data (Schema.org) found', issueGe: 'სტრუქტურირებული მონაცემები არ არის', location: '<script type="application/ld+json">', fix: 'Add Schema.org markup (Organization, WebPage, etc.)', fixGe: 'დაამატეთ Schema.org მარკაპი', details: `${SEVERITY_PHRASES.medium} Schema.org მარკაპი ეხმარება Google-ს გვერდის შინაარსის გაგებაში და შეუძლია Rich Snippets-ის გამოჩენა ძიებაში.` });
  if (schema.invalid > 0) issues.push({ id: 'invalid-schema', severity: 'critical', category: 'Schema', issue: `${schema.invalid} schema block(s) with invalid JSON`, issueGe: `${schema.invalid} schema ბლოკს აქვს არასწორი JSON`, location: 'Schema', fix: 'Fix JSON syntax errors', fixGe: 'გაასწორეთ JSON სინტაქსის შეცდომები', details: `${SEVERITY_PHRASES.critical} არასწორი JSON სინტაქსი. Google ვერ წაიკითხავს schema მონაცემებს. შეამოწმეთ JSON validator-ით.` });
  if (schema.missingContext > 0) issues.push({ id: 'schema-no-context', severity: 'high', category: 'Schema', issue: `${schema.missingContext} schema block(s) missing @context`, issueGe: `${schema.missingContext} schema ბლოკს აკლია @context`, location: 'Schema', fix: 'Add "@context": "https://schema.org"', fixGe: 'დაამატეთ @context', details: `${SEVERITY_PHRASES.high} @context აუცილებელია Schema.org-ის სწორად მუშაობისთვის.` });
  schema.details.forEach((s: SchemaItem) => { if (s.issues.length > 0 && s.type !== 'Invalid JSON') issues.push({ id: `schema-${s.index}`, severity: 'high', category: 'Schema', issue: `${s.type}: ${s.issues.join(', ')}`, issueGe: `${s.type}: ${s.issues.join(', ')}`, location: `Schema #${s.index}`, fix: 'Add required fields', fixGe: 'დაამატეთ საჭირო ველები', details: `${SEVERITY_PHRASES.high} ${s.type} სქემას აკლია: ${s.issues.join(', ')}` }); });

  // Social
  if (!social.isComplete) { const missing = [!social.og.title && 'og:title', !social.og.description && 'og:description', !social.og.image && 'og:image', !social.og.url && 'og:url'].filter(Boolean); issues.push({ id: 'incomplete-og', severity: 'medium', category: 'სოციალური', issue: `Missing Open Graph tags: ${missing.join(', ')}`, issueGe: `აკლია Open Graph ტეგები`, location: '<meta property="og:*">', fix: 'Add all required OG tags', fixGe: 'დაამატეთ ყველა საჭირო OG ტეგი', details: `${SEVERITY_PHRASES.medium} აკლია: ${missing.join(', ')}. Open Graph ტეგები განსაზღვრავს როგორ გამოჩნდება გვერდი Facebook-ზე და სხვა სოციალურ ქსელებში გაზიარებისას.` }); }
  if (!social.twitter.card) issues.push({ id: 'no-twitter-card', severity: 'low', category: 'სოციალური', issue: 'Missing Twitter Card meta tags', issueGe: 'Twitter Card ტეგები არ არის', location: '<meta name="twitter:card">', fix: 'Add Twitter Card tags', fixGe: 'დაამატეთ Twitter Card ტეგები', details: `${SEVERITY_PHRASES.low} Twitter Card ტეგები განსაზღვრავს როგორ გამოჩნდება გვერდი Twitter/X-ზე გაზიარებისას.` });

  // Accessibility & ARIA
  if (accessibility.buttonsWithoutLabel > 0) issues.push({ id: 'btn-no-label', severity: 'medium', category: 'ხელმისაწვდომობა', issue: `${accessibility.buttonsWithoutLabel} button(s) without accessible label`, issueGe: `${accessibility.buttonsWithoutLabel} ღილაკს არ აქვს ლეიბლი`, location: '<button>', fix: 'Add text content or aria-label', fixGe: 'დაამატეთ ტექსტი ან aria-label', details: `${SEVERITY_PHRASES.medium} ღილაკებს სჭირდებათ ხელმისაწვდომი ტექსტი სკრინრიდერებისთვის.` });
  if (accessibility.inputsWithoutLabel > 0) issues.push({ id: 'input-no-label', severity: 'medium', category: 'ხელმისაწვდომობა', issue: `${accessibility.inputsWithoutLabel} input(s) without label`, issueGe: `${accessibility.inputsWithoutLabel} ველს არ აქვს ლეიბლი`, location: '<input>', fix: 'Add <label> element or aria-label', fixGe: 'დაამატეთ <label> ან aria-label', details: `${SEVERITY_PHRASES.medium} ფორმის ველებს სჭირდებათ <label> ხელმისაწვდომობისთვის.` });
  if (accessibility.linksWithoutText > 0) issues.push({ id: 'link-no-text', severity: 'medium', category: 'ხელმისაწვდომობა', issue: `${accessibility.linksWithoutText} link(s) without text content`, issueGe: `${accessibility.linksWithoutText} ბმულს არ აქვს ტექსტი`, location: '<a>', fix: 'Add link text or aria-label', fixGe: 'დაამატეთ ტექსტი ან aria-label', details: `${SEVERITY_PHRASES.medium} ბმულებს სჭირდებათ ტექსტი რომ სკრინრიდერებმა წაიკითხონ.` });
  if (accessibility.aria.missingLandmarks.length > 0) issues.push({ id: 'missing-landmarks', severity: 'medium', category: 'ხელმისაწვდომობა', issue: `Missing ARIA landmarks: ${accessibility.aria.missingLandmarks.join(', ')}`, issueGe: `აკლია ARIA landmarks`, location: '<main>, <nav>', fix: 'Add semantic landmark elements', fixGe: 'დაამატეთ სემანტიკური ელემენტები', details: `${SEVERITY_PHRASES.medium} აკლია: ${accessibility.aria.missingLandmarks.join(', ')}. ARIA landmarks (<main>, <nav>, <header>) ეხმარება სკრინრიდერებს ნავიგაციაში.` });

  // DOM
  if (dom.maxDepth > 32) issues.push({ id: 'deep-dom', severity: 'medium', category: 'სიჩქარე', issue: `DOM nesting too deep (${dom.maxDepth} levels)`, issueGe: `DOM ძალიან ღრმაა (${dom.maxDepth} დონე)`, location: 'DOM', fix: 'Flatten nested HTML structure', fixGe: 'გააბრტყელეთ HTML სტრუქტურა', details: `${SEVERITY_PHRASES.medium} ღრმა DOM სტრუქტურა ანელებს რენდერინგს. რეკომენდებული მაქსიმუმი: 32 დონე.` });
  if (dom.totalElements > 1500) issues.push({ id: 'large-dom', severity: 'medium', category: 'სიჩქარე', issue: `Large DOM size (${dom.totalElements} elements)`, issueGe: `დიდი DOM (${dom.totalElements} ელემენტი)`, location: 'DOM', fix: 'Reduce DOM elements, use virtualization', fixGe: 'შეამცირეთ ელემენტები', details: `${SEVERITY_PHRASES.medium} დიდი DOM ანელებს JavaScript-ის შესრულებას და რენდერინგს. რეკომენდებული: <1500 ელემენტი.` });
  if (dom.duplicateIds.length > 0) issues.push({ id: 'duplicate-ids', severity: 'high', category: 'ხელმისაწვდომობა', issue: `Duplicate element IDs found`, issueGe: `დუბლირებული ID-ები ნაპოვნია`, location: '[id]', fix: 'Make all IDs unique', fixGe: 'გამოიყენეთ უნიკალური ID-ები', details: `${SEVERITY_PHRASES.high} დუბლირებული ID-ები: ${dom.duplicateIds.slice(0, 5).join(', ')}. ID-ები უნდა იყოს უნიკალური HTML-ში.` });
  if (dom.deprecatedElements.length > 0) issues.push({ id: 'deprecated', severity: 'low', category: 'ტექნიკური', issue: `Deprecated HTML elements found`, issueGe: `მოძველებული HTML ელემენტები`, location: 'HTML', fix: 'Replace with modern semantic tags', fixGe: 'შეცვალეთ თანამედროვე ტეგებით', details: `${SEVERITY_PHRASES.low} ნაპოვნი მოძველებული ელემენტები: ${dom.deprecatedElements.join(', ')}. გამოიყენეთ CSS და თანამედროვე HTML.` });

  // Performance
  if (performance.renderBlockingScripts > 3) issues.push({ id: 'render-blocking', severity: 'medium', category: 'სიჩქარე', issue: `${performance.renderBlockingScripts} render-blocking scripts in <head>`, issueGe: `${performance.renderBlockingScripts} მბლოკავი სკრიპტი <head>-ში`, location: '<head> <script>', fix: 'Add async or defer attribute to scripts', fixGe: 'დაამატეთ async ან defer ატრიბუტი', details: `${SEVERITY_PHRASES.medium} render-blocking სკრიპტები ანელებს გვერდის ჩატვირთვას. გამოიყენეთ async/defer ან გადაიტანეთ </body>-ის წინ.` });
  if (performance.preloadsWithoutAs > 0) issues.push({ id: 'preload-no-as', severity: 'medium', category: 'სიჩქარე', issue: `${performance.preloadsWithoutAs} preload link(s) missing "as" attribute`, issueGe: `${performance.preloadsWithoutAs} preload-ს აკლია "as" ატრიბუტი`, location: '<link rel="preload">', fix: 'Add as="script|style|font|image"', fixGe: 'დაამატეთ as ატრიბუტი', details: `${SEVERITY_PHRASES.medium} preload-ს სჭირდება "as" ატრიბუტი პრიორიტეტის სწორად განსაზღვრისთვის.` });

  // Security
  if (security.mixedContentCount > 0) issues.push({ id: 'mixed-content', severity: 'critical', category: 'უსაფრთხოება', issue: `${security.mixedContentCount} HTTP resource(s) on HTTPS page`, issueGe: `${security.mixedContentCount} HTTP რესურსი HTTPS გვერდზე`, location: '<img>, <script>', fix: 'Change all resources to HTTPS', fixGe: 'შეცვალეთ ყველა რესურსი HTTPS-ით', details: `${SEVERITY_PHRASES.critical} Mixed content ბლოკავს რესურსებს და აჩვენებს უსაფრთხოების გაფრთხილებას. პრობლემური URL-ები: ${security.mixedContentUrls.slice(0, 3).join(', ')}` });

  // Platform
  if (platform.isCSR) issues.push({ id: 'csr', severity: 'high', category: 'ტექნიკური', issue: 'Page appears to be Client-Side Rendered', issueGe: 'გვერდი არის CSR (Client-Side Rendered)', location: '<body>', fix: 'Consider Server-Side Rendering (SSR) for SEO', fixGe: 'გამოიყენეთ SSR SEO-სთვის', details: `${SEVERITY_PHRASES.high} CSR გვერდები უფრო რთულია Google-ის დასაინდექსად. გამოიყენეთ SSR ან SSG Next.js/Nuxt.js-ით.` });

  // Favicon
  if (!technical.favicon) issues.push({ id: 'no-favicon', severity: 'low', category: 'ტექნიკური', issue: 'No favicon found', issueGe: 'Favicon არ არის', location: '<head>', fix: 'Add <link rel="icon" href="/favicon.ico">', fixGe: 'დაამატეთ favicon', details: `${SEVERITY_PHRASES.low} Favicon ჩნდება ბრაუზერის ტაბზე და ბუკმარკებში. პროფესიონალური იმიჯისთვის აუცილებელია.` });

  return issues;
}

// ============================================
// COLLECT PASSED
// ============================================

function collectPassed(data: any): string[] {
  const passed: string[] = [];
  const { technical, international, content, links, images, schema, social, accessibility, dom, performance, security, trustSignals } = data;

  if (technical.title.isOptimal) passed.push('სათაური ოპტიმალურია ✓');
  if (technical.metaDesc.isOptimal) passed.push('მეტა აღწერა ოპტიმალურია ✓');
  if (content.headings.h1.length === 1) passed.push('ერთი H1 ✓');
  if (content.wordCount >= 300) passed.push(`კონტენტი (${content.wordCount} სიტყვა) ✓`);
  if (content.readability.fleschScore >= 60) passed.push(`Flesch: ${content.readability.fleschScore} ✓`);
  if (images.withoutAlt === 0 && images.total > 0) passed.push('ყველა სურათს აქვს alt ✓');
  if (images.withoutDimensions === 0 && images.total > 0) passed.push('სურათებს აქვთ ზომები ✓');
  if (links.broken === 0) passed.push('გატეხილი ბმულები არ არის ✓');
  if (schema.count > 0 && schema.invalid === 0) passed.push(`Schema.org (${schema.types.join(', ')}) ✓`);
  if (social.isComplete) passed.push('Open Graph სრულია ✓');
  if (social.twitter.card) passed.push('Twitter Card ✓');
  if (accessibility.hasLangAttribute) passed.push(`lang: ${technical.language} ✓`);
  if (technical.canonical.href && technical.canonical.count === 1) passed.push('Canonical ✓');
  if (technical.viewport.isMobileOptimized) passed.push('Viewport ✓');
  if (technical.favicon) passed.push('Favicon ✓');
  if (technical.appleTouchIcon) passed.push('Apple Touch Icon ✓');
  if (technical.charset) passed.push('Charset ✓');
  if (technical.llmsTxt.found) passed.push('llms.txt ✓');
  if (international.hreflangs.length > 0 && international.hasXDefault && international.hasSelfReference) passed.push(`Hreflang (${international.hreflangs.length}) ✓`);
  if (security.isHttps) passed.push('HTTPS ✓');
  if (security.mixedContentCount === 0 && security.isHttps) passed.push('No mixed content ✓');
  if (performance.preconnects > 0) passed.push(`Preconnect (${performance.preconnects}) ✓`);
  if (performance.preloads > 0) passed.push(`Preload (${performance.preloads}) ✓`);
  if (accessibility.hasSkipLink) passed.push('Skip link ✓');
  if (accessibility.hasMainLandmark) passed.push('Main landmark ✓');
  if (accessibility.aria.ariaLabels > 0) passed.push(`ARIA labels (${accessibility.aria.ariaLabels}) ✓`);
  if (dom.duplicateIds.length === 0) passed.push('უნიკალური ID-ები ✓');
  if (dom.deprecatedElements.length === 0) passed.push('მოძველებული ელემენტები არ არის ✓');
  if (trustSignals.hasAboutPage) passed.push('About page ✓');
  if (trustSignals.hasContactPage) passed.push('Contact page ✓');
  if (trustSignals.hasPrivacyPage) passed.push('Privacy page ✓');
  if (trustSignals.hasAuthor) passed.push('Author ✓');
  if (trustSignals.socialLinksCount > 0) passed.push(`Social (${trustSignals.socialPlatforms.join(', ')}) ✓`);

  return passed;
}

// ============================================
// CALCULATE SCORE
// ============================================

function calculateScore(issues: AuditIssue[], passed: string[]): number {
  let score = 100;
  issues.forEach((i) => { switch (i.severity) { case 'critical': score -= 15; break; case 'high': score -= 8; break; case 'medium': score -= 4; break; case 'low': score -= 1; break; } });
  score += Math.min(10, passed.length * 0.5);
  return Math.max(0, Math.min(100, Math.round(score)));
}
