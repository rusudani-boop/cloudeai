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
  RenderMethod,
  MobileData,
  ExternalResourcesData,
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
  const content = analyzeContent(doc, htmlLower, technical.title.value, technical.language);
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
  const mobile = analyzeMobile(doc, html, sourceUrl);
  const externalResources = analyzeExternalResources(doc, sourceUrl);

  // New analyses
  const coreWebVitals = analyzeCoreWebVitals(doc, images, performance, domData);
  const urlStructure = analyzeUrlStructure(sourceUrl);
  const crawl = analyzeCrawl(doc, technical, content);
  const contentQuality = analyzeContentQuality(doc, content);
  const eeat = analyzeEEAT(doc, trustSignals, security, schema);
  const serverResponse = getDefaultServerResponse();

  const issues = collectIssues({ technical, international, content, links, images, schema, social, accessibility, dom: domData, performance, security, platform, mobile, coreWebVitals, urlStructure, crawl, contentQuality, eeat });
  const passed = collectPassed({ technical, international, content, links, images, schema, social, accessibility, dom: domData, performance, security, platform, trustSignals, mobile, coreWebVitals, urlStructure, crawl, contentQuality, eeat, serverResponse });
  const score = calculateScore(issues, passed);

  // Calculate actual checks performed (issues found + passed + base neutral checks)
  // Base checks: items that are checked but may not appear in issues or passed (like optional hreflang)
  const baseChecks = 25; // robots.txt, sitemap, performance metrics, security headers, CWV, etc.
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
    technical, international, content, links, images, schema, social, accessibility, dom: domData, performance, security, platform, trustSignals, mobile, externalResources,
    coreWebVitals, urlStructure, crawl, contentQuality, eeat, serverResponse,
    issues, passed,
  };
}

// ============================================
// FLESCH READING SCORE (Multi-language support)
// ============================================

// Detect primary language of text
function detectLanguage(text: string): 'ka' | 'ru' | 'de' | 'en' | 'es' {
  const sample = text.substring(0, 2000);
  const sampleLower = sample.toLowerCase();

  // Count Georgian characters (უნიკოდი: U+10A0 - U+10FF)
  const georgianChars = (sample.match(/[\u10A0-\u10FF]/g) || []).length;

  // Count Cyrillic characters (Russian: U+0400 - U+04FF)
  const cyrillicChars = (sample.match(/[\u0400-\u04FF]/g) || []).length;

  // Count German-specific characters and common German words
  const germanUmlauts = (sample.match(/[äöüÄÖÜß]/g) || []).length;
  const germanWords = (sampleLower.match(/\b(und|der|die|das|ist|sind|haben|werden|nicht|auch|für|mit|auf|dem|des|ein|eine|zu|von|bei|nach|über|vor|durch|unter|gegen|ohne|seit|während|wegen)\b/g) || []).length;

  // Count Spanish-specific characters and common Spanish words
  const spanishChars = (sample.match(/[ñÑ¿¡áéíóúÁÉÍÓÚü]/g) || []).length;
  const spanishWords = (sampleLower.match(/\b(el|la|los|las|de|que|en|es|por|con|para|como|más|pero|sus|le|ya|del|al|un|una|este|esta|son|se|no|hay|fue|todo|esta|ser|sobre|también|cuando|muy|sin|hasta|desde|donde|quien|entre|después|antes|durante|hacia|contra|según)\b/g) || []).length;

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

  // Spanish detection: Spanish chars OR common Spanish words
  if (spanishChars > 3 || spanishWords > 8) return 'es';

  return 'en';
}

// Count syllables based on detected language
function countSyllables(word: string, lang: 'ka' | 'ru' | 'de' | 'en' | 'es'): number {
  word = word.toLowerCase();

  if (lang === 'ka') {
    // Georgian vowels: ა, ე, ი, ო, უ
    // Filter to only Georgian letters first
    const georgianWord = word.replace(/[^\u10A0-\u10FF]/g, '');
    if (!georgianWord) return 1;
    const vowels = georgianWord.match(/[აეიოუ]/g);
    // Georgian words tend to have more syllables per word
    return vowels ? Math.max(1, vowels.length) : 1;
  }

  if (lang === 'ru') {
    // Russian vowels: а, е, ё, и, о, у, ы, э, ю, я
    // Filter to only Cyrillic letters
    const cyrillicWord = word.replace(/[^\u0400-\u04FF]/g, '');
    if (!cyrillicWord) return 1;
    const vowels = cyrillicWord.match(/[аеёиоуыэюя]/g);
    return vowels ? Math.max(1, vowels.length) : 1;
  }

  if (lang === 'de') {
    // German vowels including umlauts
    const cleanWord = word.replace(/[^a-zäöüß]/g, '');
    if (!cleanWord) return 1;
    // German diphthongs count as 1 syllable: ei, ie, eu, äu, au, oi, ey, ay
    // Also handle: tion, sion (2 syllables each)
    let processed = cleanWord
      .replace(/tion|sion/g, 'XX')  // These are 2 syllables
      .replace(/ei|ie|eu|äu|au|oi|ey|ay|ee|oo/g, 'V');  // Single syllable diphthongs
    const vowels = processed.match(/[aeiouäöüVX]/g);
    return vowels ? Math.max(1, vowels.length) : 1;
  }

  if (lang === 'es') {
    // Spanish vowels: a, e, i, o, u (with accents: á, é, í, ó, ú)
    const cleanWord = word.replace(/[^a-záéíóúüñ]/g, '');
    if (!cleanWord) return 1;
    // Spanish diphthongs count as 1 syllable: ai, au, ei, eu, oi, ou, ia, ie, io, iu, ua, ue, ui, uo
    // Hiatus (two separate syllables): combinations with accented vowels
    let processed = cleanWord
      .replace(/[áéíóú]/g, 'V') // Accented vowels often form hiatus
      .replace(/ai|au|ei|eu|oi|ou|ia|ie|io|iu|ua|ue|ui|uo/g, 'D'); // Diphthongs = 1 syllable
    const vowels = processed.match(/[aeiouVD]/g);
    return vowels ? Math.max(1, vowels.length) : 1;
  }

  // English syllable counting - improved algorithm
  const englishWord = word.replace(/[^a-z]/g, '');
  if (!englishWord) return 1;
  if (englishWord.length <= 3) return 1;

  // Handle common word endings that don't add syllables
  let w = englishWord
    .replace(/(?:[^laeiouy]es|[^laeiouy]ed)$/, '') // -es, -ed after consonant
    .replace(/(?:le)$/, 'le')  // Keep -le as syllable
    .replace(/(?:[^aeiou]e)$/, ''); // Silent e after consonant

  if (w.startsWith('y')) w = w.substring(1);

  // Count vowel groups
  const matches = w.match(/[aeiouy]+/g);
  const count = matches ? matches.length : 1;

  // Common patterns that reduce syllables
  // Words like "create" have 2 syllables not 3
  return Math.max(1, count);
}

function calculateReadability(text: string): ReadabilityData {
  // Clean the text - remove extra whitespace and non-content
  const cleanText = text.replace(/\s+/g, ' ').trim();

  // Detect language first
  const lang = detectLanguage(cleanText);

  // Split sentences - handle various punctuation
  const sentences = cleanText.split(/[.!?։।;]+/).filter((s) => s.trim().length > 10);
  const totalSentences = Math.max(sentences.length, 1);

  // Get words - filter out very short tokens (supports Georgian, Cyrillic, Latin, German, Spanish)
  const words = cleanText.split(/\s+/).filter((w) => {
    const lettersOnly = w.replace(/[^\u10A0-\u10FF\u0400-\u04FFa-zA-ZäöüÄÖÜßáéíóúÁÉÍÓÚñÑü]/g, '');
    return lettersOnly.length >= 2;
  });
  const totalWords = words.length;

  if (totalWords < 10) {
    return {
      fleschScore: 0,
      fleschGrade: 'არასაკმარისი კონტენტი / Insufficient content',
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
    // German Flesch formula (Amstad) - adjusted for longer German words
    // German words average ~2.5 syllables vs English ~1.5
    // Standard Amstad: 180 - ASL - (58.5 * ASW)
    fleschScore = 180 - avgSentenceLength - (48 * avgSyllablesPerWord);
  } else if (lang === 'ka') {
    // Georgian adapted formula
    // Georgian is agglutinative with many suffixes, average ~3 syllables per word
    fleschScore = 206.835 - (0.8 * avgSentenceLength) - (35 * avgSyllablesPerWord);
  } else if (lang === 'ru') {
    // Russian adapted formula
    // Russian averages ~2.5 syllables per word
    fleschScore = 206.835 - (1.0 * avgSentenceLength) - (45 * avgSyllablesPerWord);
  } else if (lang === 'es') {
    // Spanish Fernández Huerta formula (adapted from Flesch)
    // Spanish averages ~2.0 syllables per word
    fleschScore = 206.84 - (1.0 * avgSentenceLength) - (55 * avgSyllablesPerWord);
  } else {
    // English Flesch-Kincaid formula - adjusted for web content
    // Standard formula can be too aggressive for technical/professional content
    // Original: 206.835 - (1.015 * ASL) - (84.6 * ASW)
    // Adjusted to be less punishing for longer sentences common in web content
    fleschScore = 206.835 - (0.9 * avgSentenceLength) - (70 * avgSyllablesPerWord);
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
  const h1Element = doc.querySelector('h1');
  const visibleTitle = h1Element?.textContent?.trim() || title; // H1 is the visible title, fallback to <title>
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
    title: { value: title, visibleTitle, length: title.length, isOptimal: title.length >= 30 && title.length <= 60 },
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

  // Check for duplicate hreflang language codes (normalize to base language)
  // de-DE and de should be considered same language pointing to same URL = duplicate
  const duplicateHreflangs: string[] = [];
  const seenLangs = new Map<string, { variants: string[]; urls: string[] }>();

  hreflangs.forEach((h) => {
    if (h.hreflang === 'x-default') return;

    // Normalize to base language (de-DE -> de, en-US -> en)
    const baseLang = h.hreflang.toLowerCase().split('-')[0];
    const normalizedUrl = h.href.toLowerCase().replace(/\/$/, '');
    const existing = seenLangs.get(baseLang);

    if (existing) {
      if (!existing.variants.includes(h.hreflang)) existing.variants.push(h.hreflang);
      existing.urls.push(normalizedUrl);
    } else {
      seenLangs.set(baseLang, { variants: [h.hreflang], urls: [normalizedUrl] });
    }
  });

  // Find problematic duplicates
  seenLangs.forEach((data, baseLang) => {
    const uniqueUrls = [...new Set(data.urls)];
    // If same URL appears multiple times with same base language = duplicate
    if (data.urls.length > uniqueUrls.length) {
      duplicateHreflangs.push(`${baseLang}: ${data.variants.join(' & ')} → იგივე URL-ზე მიუთითებს`);
    }
    // If both "de" and "de-DE" exist - potentially confusing
    else if (data.variants.length > 1 && data.variants.some(v => !v.includes('-')) && data.variants.some(v => v.includes('-'))) {
      duplicateHreflangs.push(`${baseLang}: ${data.variants.join(' & ')} → დააზუსტეთ (გამოიყენეთ ან ${baseLang} ან ${baseLang}-XX)`);
    }
  });

  // Check for hreflangs pointing to non-canonical URLs (URLs with query params, fragments, or inconsistent trailing slashes)
  const nonCanonicalHreflangs: string[] = [];
  hreflangs.forEach((h, i) => {
    if (h.href) {
      try {
        const url = new URL(h.href);
        // Check for query parameters (might indicate non-canonical)
        if (url.search && url.search.length > 1) {
          nonCanonicalHreflangs.push(`${h.hreflang}: has query params (${url.search})`);
        }
        // Check for fragments
        if (url.hash && url.hash.length > 1) {
          nonCanonicalHreflangs.push(`${h.hreflang}: has fragment (${url.hash})`);
        }
      } catch {}
    }
    if (h.href && !h.href.startsWith('http')) issues.push(`Hreflang #${i + 1}: Relative URL`);
    if (h.hreflang && h.hreflang !== 'x-default' && h.hreflang.includes('-')) {
      const parts = h.hreflang.split('-');
      if (parts.length === 2 && parts[1] !== parts[1].toUpperCase()) issues.push(`Hreflang #${i + 1}: Region should be uppercase`);
    }
  });

  return { hreflangs, hasXDefault, hasSelfReference, canonicalInHreflang, langMatchesHreflang, issues, duplicateHreflangs, nonCanonicalHreflangs };
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

function analyzeContent(doc: Document, htmlLower: string, title: string, htmlLang: string | null) {
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

  // Detect actual content language - prioritize HTML lang attribute
  const contentLanguage = detectLanguage(bodyText);

  // Map HTML lang attribute to our language codes
  let declaredLanguage: 'ka' | 'ru' | 'de' | 'en' | 'es' | null = null;
  if (htmlLang) {
    const langCode = htmlLang.toLowerCase().split('-')[0];
    if (langCode === 'ka') declaredLanguage = 'ka';
    else if (langCode === 'ru' || langCode === 'uk' || langCode === 'be') declaredLanguage = 'ru'; // Ukrainian, Belarusian treated as Russian for readability
    else if (langCode === 'de') declaredLanguage = 'de';
    else if (langCode === 'en') declaredLanguage = 'en';
    else if (langCode === 'es') declaredLanguage = 'es'; // Spanish
  }

  // Use declared language if available, otherwise use detected language
  const detectedLanguage = declaredLanguage || contentLanguage;

  // Detect H1/visible title language
  const visibleTitleText = headings.h1[0] || title;
  const titleLanguage = visibleTitleText.length > 10 ? detectLanguage(visibleTitleText) : null;

  // Check if title language matches content language
  // Allow brand names in English: if title is detected as English but declared language is different,
  // check if removing brand-like words (short capitalized words, common tech/brand terms) leaves non-English text
  let titleContentLangMismatch = titleLanguage && detectedLanguage && titleLanguage !== detectedLanguage;

  if (titleContentLangMismatch && titleLanguage === 'en' && declaredLanguage && declaredLanguage !== 'en') {
    // Common brand patterns: capitalized short words, tech/company suffixes
    // If the title has brand-like patterns and the rest matches declared language, it's OK
    const titleWords = visibleTitleText.split(/[\s\-–—|:]+/).filter(w => w.length > 0);

    // Remove potential brand words: all-caps, CamelCase, short words (≤6 chars), common suffixes
    const nonBrandWords = titleWords.filter(word => {
      const cleanWord = word.replace(/[^\p{L}]/gu, '');
      if (!cleanWord) return false;
      // Skip if: all uppercase, very short, or looks like a brand name (CamelCase, trademark symbols)
      if (cleanWord.length <= 4) return false; // Short words often brands: Nike, Zara, BMW
      if (cleanWord === cleanWord.toUpperCase() && cleanWord.length <= 6) return false; // ACME, IBM
      if (/^[A-Z][a-z]+[A-Z]/.test(cleanWord)) return false; // CamelCase like iPhone
      return true;
    });

    // If remaining text matches declared language or is minimal, allow it
    const remainingText = nonBrandWords.join(' ');
    if (remainingText.length < 15 || nonBrandWords.length <= 2) {
      // Title is mostly brand name, allow it
      titleContentLangMismatch = false;
    } else {
      // Check if remaining text matches declared language
      const remainingLang = detectLanguage(remainingText);
      if (remainingLang === declaredLanguage) {
        titleContentLangMismatch = false;
      }
    }
  }

  // Keyword extraction - include Georgian, Cyrillic, German umlauts, Spanish
  // Focus on longer words (4+ chars) which are more likely to be nouns/verbs
  const wordFreq: Record<string, number> = {};
  const cleanedWords: string[] = [];

  words.forEach((w) => {
    // Keep Georgian (U+10A0-U+10FF), Cyrillic (U+0400-U+04FF), Latin + German umlauts + Spanish
    const word = w.toLowerCase().replace(/[^\u10A0-\u10FF\u0400-\u04FFa-z0-9äöüßáéíóúñ]/g, '');
    cleanedWords.push(word);
    // Require 4+ characters for better noun/verb detection (excludes most prepositions/articles)
    if (word.length >= 4 && !PATTERNS.STOP_WORDS.has(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });
  const keywordDensity = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count, percentage: Math.round((count / wordCount) * 10000) / 100 }));

  // Long-tail keyword extraction (2-3 word phrases)
  const phraseFreq: Record<string, number> = {};
  for (let i = 0; i < cleanedWords.length - 1; i++) {
    const w1 = cleanedWords[i];
    const w2 = cleanedWords[i + 1];
    const w3 = cleanedWords[i + 2];

    // Skip if words are stop words or too short
    const isValidWord = (w: string) => w && w.length >= 3 && !PATTERNS.STOP_WORDS.has(w);

    // 2-word phrases: both words must be valid
    if (isValidWord(w1) && isValidWord(w2)) {
      const phrase2 = `${w1} ${w2}`;
      phraseFreq[phrase2] = (phraseFreq[phrase2] || 0) + 1;
    }

    // 3-word phrases: first and last must be valid, middle can be a stop word (for patterns like "best X for Y")
    if (isValidWord(w1) && w2 && w2.length >= 2 && isValidWord(w3)) {
      const phrase3 = `${w1} ${w2} ${w3}`;
      phraseFreq[phrase3] = (phraseFreq[phrase3] || 0) + 1;
    }
  }

  // Filter to phrases appearing 2+ times and sort by frequency
  const longTailKeywords = Object.entries(phraseFreq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase, count]) => ({ phrase, count }));

  return { headings, wordCount, characterCount, sentenceCount: sentences.length, paragraphCount: paragraphs.length, readingTime, titleH1Duplicate, duplicateParagraphs, aiScore, aiPhrases, readability, keywordDensity, longTailKeywords, detectedLanguage, titleLanguage, titleContentLangMismatch };
}

// ============================================
// LINK ANALYSIS
// ============================================

function analyzeLinks(doc: Document, sourceUrl: string) {
  const links = Array.from(doc.querySelectorAll('a[href]'));
  let sourceHost = '';
  let baseUrl = '';
  try {
    const parsed = new URL(sourceUrl);
    sourceHost = parsed.hostname;
    baseUrl = `${parsed.protocol}//${parsed.host}`;
  } catch {}

  let internal = 0, external = 0, broken = 0, genericAnchors = 0, nofollow = 0, sponsored = 0, ugc = 0, unsafeExternalCount = 0;
  const brokenList: { href: string; text: string; status: number }[] = [];
  const genericAnchorsList: { text: string; href: string }[] = [];
  const internalUrls: { href: string; text: string }[] = []; // For redirect checking
  const externalUrls: { href: string; text: string }[] = []; // For 404 checking

  links.forEach((a) => {
    const href = a.getAttribute('href') || '';
    const text = a.textContent?.trim().toLowerCase() || '';
    const rel = a.getAttribute('rel') || '';

    if (PATTERNS.EMPTY_HREFS.includes(href)) { broken++; brokenList.push({ href: href || '(empty)', text: text.substring(0, 50), status: 0 }); }

    // Track internal vs external and collect full internal URLs
    let isInternal = false;
    let fullUrl = '';
    if (href.startsWith('http')) {
      try {
        const linkHost = new URL(href).hostname;
        if (linkHost === sourceHost) {
          isInternal = true;
          fullUrl = href;
        } else {
          external++;
          // Collect external URLs for 404 checking and display
          if (externalUrls.length < 50) {
            externalUrls.push({ href, text: text.substring(0, 80) });
          }
        }
      } catch {}
    } else if (href.startsWith('/')) {
      isInternal = true;
      fullUrl = baseUrl + href;
    } else if (href.startsWith('./') || (!href.includes(':') && href && !href.startsWith('#'))) {
      isInternal = true;
      try { fullUrl = new URL(href, sourceUrl).href; } catch {}
    }

    if (isInternal) {
      internal++;
      if (fullUrl && !href.includes('#') && internalUrls.length < 50) {
        internalUrls.push({ href: fullUrl, text: text.substring(0, 80) });
      }
    }

    if (PATTERNS.GENERIC_ANCHORS.includes(text)) { genericAnchors++; genericAnchorsList.push({ text, href: href.substring(0, 50) }); }
    if (rel.includes('nofollow')) nofollow++;
    if (rel.includes('sponsored')) sponsored++;
    if (rel.includes('ugc')) ugc++;
    if (a.getAttribute('target') === '_blank' && !rel.includes('noopener')) unsafeExternalCount++;
  });

  return {
    total: links.length, internal, external, broken, brokenList: brokenList.slice(0, 10),
    genericAnchors, genericAnchorsList: genericAnchorsList.slice(0, 10),
    nofollow, sponsored, ugc, unsafeExternalCount,
    hasFooterLinks: !!doc.querySelector('footer a'), hasNavLinks: !!doc.querySelector('nav a'),
    internalUrls: internalUrls.slice(0, 50), // For redirect checking and display
    externalUrls: externalUrls.slice(0, 50), // For 404 checking and display
    redirectLinks: 0, redirectList: [] as { href: string; text: string; status: number; location: string }[],
    brokenExternalLinks: 0, brokenExternalList: [] as { href: string; text: string; status: number; error?: string }[]
  };
}

// ============================================
// IMAGE ANALYSIS
// ============================================

function analyzeImages(doc: Document) {
  const images = Array.from(doc.querySelectorAll('img'));
  const lazyLoaded = images.filter((img) => img.getAttribute('loading') === 'lazy').length;
  const lazyAboveFold = images.slice(0, 3).filter((img) => img.getAttribute('loading') === 'lazy').length;
  const clickableWithoutAlt = images.filter((img) => { const p = img.parentElement; return (p?.tagName === 'A' || p?.tagName === 'BUTTON') && !img.getAttribute('alt'); }).length;
  const srcsetCount = images.filter((img) => img.hasAttribute('srcset')).length;
  const modernFormats = images.filter((img) => { const src = img.getAttribute('src') || ''; return src.includes('.webp') || src.includes('.avif'); }).length;

  // Check for broken/invalid image sources
  const brokenImages: { src: string; alt: string }[] = [];
  // Collect image URLs for size checking
  const imageUrls: { src: string; alt: string }[] = [];
  // Collect images without alt
  const withoutAltList: { src: string; context: string }[] = [];
  // Collect images without dimensions
  const withoutDimensionsList: { src: string; alt: string }[] = [];
  // Collect images with empty alt
  const emptyAltList: { src: string; context: string }[] = [];

  images.forEach((img) => {
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt');
    const hasAlt = img.hasAttribute('alt');
    const hasWidth = img.hasAttribute('width');
    const hasHeight = img.hasAttribute('height');

    // Get context (parent tag or nearby text)
    const parent = img.parentElement;
    const context = parent?.tagName === 'A' ? `ბმულში: ${(parent.getAttribute('href') || '').substring(0, 30)}` :
                    parent?.tagName === 'FIGURE' ? 'figure ელემენტში' :
                    parent?.className ? `კლასი: ${parent.className.substring(0, 20)}` : '';

    // Check for empty, invalid, or placeholder sources
    if (!src || src === '#' || src === 'undefined' || src === 'null' ||
        src.startsWith('data:,') || src === 'about:blank' ||
        (src.startsWith('data:') && src.length < 50)) {
      brokenImages.push({ src: src || '(empty)', alt: (alt || '(no alt)').substring(0, 30) });
    } else if (src.startsWith('http') && imageUrls.length < 15) {
      // Collect external image URLs for size checking
      imageUrls.push({ src, alt: (alt || '(no alt)').substring(0, 30) });
    }

    // Track images without alt attribute
    if (!hasAlt && withoutAltList.length < 10) {
      const shortSrc = src.length > 60 ? '...' + src.substring(src.length - 50) : src;
      withoutAltList.push({ src: shortSrc, context });
    }

    // Track images with empty alt (that aren't decorative)
    if (hasAlt && alt === '' && emptyAltList.length < 10) {
      const shortSrc = src.length > 60 ? '...' + src.substring(src.length - 50) : src;
      emptyAltList.push({ src: shortSrc, context });
    }

    // Track images without dimensions
    if ((!hasWidth || !hasHeight) && withoutDimensionsList.length < 10) {
      const shortSrc = src.length > 60 ? '...' + src.substring(src.length - 50) : src;
      withoutDimensionsList.push({ src: shortSrc, alt: (alt || '(no alt)').substring(0, 30) });
    }
  });

  const withoutAlt = images.filter((img) => !img.hasAttribute('alt')).length;
  const withEmptyAlt = images.filter((img) => img.getAttribute('alt') === '').length;
  const withoutDimensions = images.filter((img) => !img.hasAttribute('width') || !img.hasAttribute('height')).length;

  return {
    total: images.length, withoutAlt, withEmptyAlt, withoutDimensions, lazyLoaded, lazyAboveFold,
    clickableWithoutAlt, decorativeCount: withEmptyAlt, largeImages: images.length - srcsetCount,
    modernFormats, srcsetCount,
    brokenCount: brokenImages.length,
    brokenList: brokenImages.slice(0, 10),
    imageUrls: imageUrls.slice(0, 15), // For size checking
    withoutAltList,
    withoutDimensionsList,
    emptyAltList
  };
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

// Helper function to parse color values
function parseColor(color: string): { r: number; g: number; b: number } | null {
  if (!color || color === 'transparent' || color === 'inherit' || color === 'initial') return null;

  // Handle rgb/rgba
  const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
  }

  // Handle hex colors
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return { r: parseInt(hexMatch[1], 16), g: parseInt(hexMatch[2], 16), b: parseInt(hexMatch[3], 16) };
  }

  // Handle short hex
  const shortHexMatch = color.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
  if (shortHexMatch) {
    return {
      r: parseInt(shortHexMatch[1] + shortHexMatch[1], 16),
      g: parseInt(shortHexMatch[2] + shortHexMatch[2], 16),
      b: parseInt(shortHexMatch[3] + shortHexMatch[3], 16)
    };
  }

  // Common color names
  const colorNames: Record<string, { r: number; g: number; b: number }> = {
    white: { r: 255, g: 255, b: 255 }, black: { r: 0, g: 0, b: 0 },
    red: { r: 255, g: 0, b: 0 }, green: { r: 0, g: 128, b: 0 }, blue: { r: 0, g: 0, b: 255 },
    gray: { r: 128, g: 128, b: 128 }, grey: { r: 128, g: 128, b: 128 },
    yellow: { r: 255, g: 255, b: 0 }, orange: { r: 255, g: 165, b: 0 },
    purple: { r: 128, g: 0, b: 128 }, pink: { r: 255, g: 192, b: 203 },
  };
  return colorNames[color.toLowerCase()] || null;
}

// Calculate relative luminance (WCAG formula)
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio between two colors
function getContrastRatio(color1: { r: number; g: number; b: number }, color2: { r: number; g: number; b: number }): number {
  const l1 = getLuminance(color1.r, color1.g, color1.b);
  const l2 = getLuminance(color2.r, color2.g, color2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

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

  // Contrast checking - analyze inline styles and style attributes
  const lowContrastElements: { element: string; text: string; colors: string; ratio: string; section: string }[] = [];
  let colorContrastIssues = 0;
  const sectionIssues: Record<string, number> = {};

  // Helper to get section name for an element
  const getSectionName = (el: Element): string => {
    // Check if inside specific semantic sections
    if (el.closest('header') || el.closest('[role="banner"]')) return 'Header';
    if (el.closest('footer') || el.closest('[role="contentinfo"]')) return 'Footer';
    if (el.closest('nav') || el.closest('[role="navigation"]')) return 'ნავიგაცია';
    if (el.closest('aside') || el.closest('[role="complementary"]')) return 'Sidebar';
    if (el.closest('main') || el.closest('[role="main"]')) return 'მთავარი კონტენტი';
    if (el.closest('form')) return 'ფორმა';
    if (el.closest('article')) return 'სტატია';
    if (el.closest('.hero') || el.closest('[class*="hero"]')) return 'Hero სექცია';
    if (el.closest('.banner') || el.closest('[class*="banner"]')) return 'ბანერი';
    if (el.closest('.card') || el.closest('[class*="card"]')) return 'ბარათი';
    if (el.closest('.btn') || el.closest('button') || el.closest('[class*="button"]')) return 'ღილაკი';
    return 'სხვა';
  };

  // Check elements with inline styles for contrast issues
  const elementsWithColor = doc.querySelectorAll('[style*="color"], [style*="background"]');
  elementsWithColor.forEach((el) => {
    const style = el.getAttribute('style') || '';
    const text = el.textContent?.trim().substring(0, 30) || '';
    if (!text) return;

    // Extract color and background-color from inline style
    const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
    const bgMatch = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);

    if (colorMatch && bgMatch) {
      const fgColor = parseColor(colorMatch[1].trim());
      const bgColor = parseColor(bgMatch[1].trim());

      if (fgColor && bgColor) {
        const ratio = getContrastRatio(fgColor, bgColor);
        // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
        if (ratio < 4.5) {
          colorContrastIssues++;
          const section = getSectionName(el);
          sectionIssues[section] = (sectionIssues[section] || 0) + 1;

          if (lowContrastElements.length < 8) {
            lowContrastElements.push({
              element: el.tagName.toLowerCase(),
              text: text,
              colors: `${colorMatch[1].trim()} / ${bgMatch[1].trim()}`,
              ratio: ratio.toFixed(2) + ':1',
              section
            });
          }
        }
      }
    }
  });

  // Check text in semantic sections for potential contrast issues
  const checkSectionContrast = (selector: string, sectionName: string) => {
    const section = doc.querySelector(selector);
    if (section) {
      const style = section.getAttribute('style') || '';
      const bgMatch = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
      if (bgMatch) {
        const bgColor = parseColor(bgMatch[1].trim());
        if (bgColor) {
          // Check if background is very light (potential white text issue) or very dark
          const luminance = getLuminance(bgColor.r, bgColor.g, bgColor.b);
          if (luminance > 0.9 || luminance < 0.1) {
            // Check child elements for color
            section.querySelectorAll('*').forEach((child) => {
              const childStyle = child.getAttribute('style') || '';
              const colorMatch = childStyle.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
              if (colorMatch) {
                const fgColor = parseColor(colorMatch[1].trim());
                if (fgColor) {
                  const ratio = getContrastRatio(fgColor, bgColor);
                  if (ratio < 4.5 && lowContrastElements.length < 8) {
                    colorContrastIssues++;
                    sectionIssues[sectionName] = (sectionIssues[sectionName] || 0) + 1;
                    lowContrastElements.push({
                      element: child.tagName.toLowerCase(),
                      text: child.textContent?.trim().substring(0, 30) || '',
                      colors: `${colorMatch[1].trim()} on ${bgMatch[1].trim()}`,
                      ratio: ratio.toFixed(2) + ':1',
                      section: sectionName
                    });
                  }
                }
              }
            });
          }
        }
      }
    }
  };

  // Check specific sections
  checkSectionContrast('header', 'Header');
  checkSectionContrast('footer', 'Footer');
  checkSectionContrast('nav', 'ნავიგაცია');
  checkSectionContrast('.hero', 'Hero სექცია');

  // Also check CSS for problematic color combinations
  const styleContent = Array.from(doc.querySelectorAll('style')).map(s => s.textContent || '').join(' ');

  // Common problematic combinations to flag
  const problematicPatterns = [
    { pattern: /color\s*:\s*#?(?:ccc|ddd|999|888|aaa|bbb)/i, desc: 'ღია ნაცრისფერი ტექსტი', section: 'CSS სტილები' },
    { pattern: /color\s*:\s*(?:lightgray|lightgrey|silver)/i, desc: 'ღია ნაცრისფერი ტექსტი', section: 'CSS სტილები' },
    { pattern: /background\s*:\s*#?(?:ff0|yellow).*color\s*:\s*#?(?:fff|white)/i, desc: 'თეთრი ყვითელზე', section: 'CSS სტილები' },
    { pattern: /\.btn[^{]*\{[^}]*color\s*:\s*#?(?:ccc|ddd|999|aaa)/i, desc: 'ღილაკის ტექსტი ღიაა', section: 'ღილაკები' },
    { pattern: /placeholder[^{]*\{[^}]*color\s*:\s*#?(?:ccc|ddd)/i, desc: 'Placeholder ძალიან ღიაა', section: 'ფორმის ველები' },
  ];

  problematicPatterns.forEach(({ pattern, desc, section }) => {
    if (pattern.test(styleContent) || pattern.test(htmlLower)) {
      colorContrastIssues++;
      sectionIssues[section] = (sectionIssues[section] || 0) + 1;
      if (lowContrastElements.length < 8) {
        lowContrastElements.push({
          element: 'CSS',
          text: desc,
          colors: 'სტილის ანალიზი',
          ratio: '< 4.5:1',
          section
        });
      }
    }
  });

  // Check for very light text colors in inline styles throughout the document
  const lightTextRegex = /color\s*:\s*#?(?:[def][def][def]|(?:rgb|rgba)\s*\(\s*(?:2[0-4]\d|25[0-5])\s*,\s*(?:2[0-4]\d|25[0-5])\s*,\s*(?:2[0-4]\d|25[0-5]))/gi;
  const lightTextMatches = htmlLower.match(lightTextRegex) || [];
  if (lightTextMatches.length > 0) {
    colorContrastIssues += Math.min(lightTextMatches.length, 3);
    sectionIssues['ღია ფერის ტექსტი'] = Math.min(lightTextMatches.length, 3);
  }

  // Contrast score calculation
  const passedWCAG_AA = colorContrastIssues === 0;
  const passedWCAG_AAA = colorContrastIssues === 0 && lowContrastElements.length === 0;
  const contrastScore = Math.max(0, 100 - (colorContrastIssues * 15));

  // Sort section issues by count
  const sortedSectionIssues = Object.entries(sectionIssues)
    .sort((a, b) => b[1] - a[1])
    .map(([section, count]) => ({ section, count }));

  const contrastDetails = {
    lowContrastElements,
    passedWCAG_AA,
    passedWCAG_AAA,
    score: contrastScore,
    sectionIssues: sortedSectionIssues
  };

  return {
    buttonsWithoutLabel, inputsWithoutLabel, linksWithoutText, iframesWithoutTitle, skippedHeadings,
    hasSkipLink, hasLangAttribute: !!doc.documentElement?.getAttribute('lang'), clickableImagesWithoutAlt: 0,
    positiveTabindex, hasMainLandmark: aria.landmarks.main > 0, hasNavLandmark: aria.landmarks.nav > 0,
    hasFocusVisible: htmlLower.includes(':focus-visible') || htmlLower.includes('focus-visible'),
    colorContrastIssues, contrastDetails, aria, tablesWithoutHeaders, autoplayMedia
  };
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

  const renderMethod: RenderMethod = isCSR ? 'csr' : 'ssr';
  return { cms: [...new Set(cms)], frameworks: [...new Set(frameworks)], analytics: [...new Set(analytics)], advertising: [...new Set(advertising)], renderMethod, isCSR, isPWA: htmlLower.includes('manifest.json') || htmlLower.includes('serviceworker'), hasAMP: htmlLower.includes('⚡') || htmlLower.includes('amp-') || htmlLower.includes('amphtml') };
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
// MOBILE FRIENDLINESS
// ============================================

function analyzeMobile(doc: Document, html: string, sourceUrl: string): MobileData {
  const issues: string[] = [];
  let score = 100;

  // Viewport analysis
  const viewportMeta = doc.querySelector('meta[name="viewport"]');
  const viewportContent = viewportMeta?.getAttribute('content') || null;
  const hasViewport = !!viewportContent;
  const hasWidthDeviceWidth = viewportContent?.includes('width=device-width') ?? false;
  const hasInitialScale = viewportContent?.includes('initial-scale') ?? false;
  const hasUserScalable = viewportContent?.includes('user-scalable=no') || viewportContent?.includes('user-scalable=0') || false;

  if (!hasViewport) {
    issues.push('Missing viewport meta tag - page will display incorrectly on mobile');
    score -= 30; // More severe penalty
  } else if (!hasWidthDeviceWidth) {
    issues.push('Viewport missing width=device-width');
    score -= 15;
  }
  if (hasUserScalable) {
    issues.push('user-scalable=no blocks zooming - accessibility issue');
    score -= 10;
  }

  // Mobile-specific meta tags
  const hasThemeColor = !!doc.querySelector('meta[name="theme-color"]');
  const hasAppleMobileWebAppCapable = !!doc.querySelector('meta[name="apple-mobile-web-app-capable"]');
  const hasAppleTouchIcon = !!doc.querySelector('link[rel="apple-touch-icon"]');
  const hasManifest = !!doc.querySelector('link[rel="manifest"]');

  // Tap target analysis - find small clickable elements
  const clickables = doc.querySelectorAll('a, button, input[type="button"], input[type="submit"], [onclick]');
  const tapTargetsList: { element: string; size: string }[] = [];
  let smallTapTargets = 0;

  clickables.forEach((el) => {
    // Check for inline styles that specify small sizes
    const style = el.getAttribute('style') || '';
    const widthMatch = style.match(/width\s*:\s*(\d+)px/);
    const heightMatch = style.match(/height\s*:\s*(\d+)px/);
    const paddingMatch = style.match(/padding\s*:\s*(\d+)px/);

    // Also check class names for common small button patterns
    const className = el.className?.toString() || '';
    const isLikelySmall = className.includes('icon') || className.includes('small') || className.includes('mini');

    if (widthMatch && parseInt(widthMatch[1]) < 44) {
      smallTapTargets++;
      if (tapTargetsList.length < 5) {
        tapTargetsList.push({ element: el.tagName.toLowerCase(), size: `${widthMatch[1]}px` });
      }
    } else if (heightMatch && parseInt(heightMatch[1]) < 44) {
      smallTapTargets++;
      if (tapTargetsList.length < 5) {
        tapTargetsList.push({ element: el.tagName.toLowerCase(), size: `${heightMatch[1]}px` });
      }
    } else if (isLikelySmall && !paddingMatch) {
      smallTapTargets++;
      if (tapTargetsList.length < 5) {
        tapTargetsList.push({ element: el.tagName.toLowerCase(), size: 'small (class-based)' });
      }
    }
  });

  if (smallTapTargets > 5) {
    issues.push(`${smallTapTargets} small tap targets - minimum 48x48px required`);
    score -= Math.min(20, smallTapTargets * 2); // More aggressive penalty
  }

  // Text size analysis - look for small font sizes in styles
  const htmlLower = html.toLowerCase();
  const smallFontMatches = htmlLower.match(/font-size\s*:\s*(\d+)px/g) || [];
  let smallTextElements = 0;
  smallFontMatches.forEach((match) => {
    const size = parseInt(match.match(/(\d+)/)?.[1] || '16');
    if (size < 12) smallTextElements++;
  });

  // Check for relative font sizes (good practice)
  const usesRelativeFontSizes = htmlLower.includes('font-size:') &&
    (htmlLower.includes('rem') || htmlLower.includes('em') || htmlLower.includes('%'));

  if (smallTextElements > 3) {
    issues.push(`${smallTextElements} elements with <12px font - hard to read on mobile`);
    score -= 10;
  }

  // Media queries analysis
  const mediaQueryMatches = html.match(/@media[^{]+\{/g) || [];
  const hasMediaQueries = mediaQueryMatches.length > 0;
  const mediaQueryCount = mediaQueryMatches.length;

  // Flexbox and Grid
  const hasFlexbox = htmlLower.includes('display: flex') || htmlLower.includes('display:flex');
  const hasGrid = htmlLower.includes('display: grid') || htmlLower.includes('display:grid');

  if (!hasMediaQueries && !hasFlexbox && !hasGrid) {
    issues.push('No responsive design detected (no media queries, flexbox, or grid)');
    score -= 25; // More severe - this is critical for mobile
  }

  // Fixed width analysis - look for elements with fixed widths > 320px
  const fixedWidthMatches = html.match(/width\s*:\s*(\d+)px/g) || [];
  let fixedWidthElements = 0;
  let horizontalScrollRisk = false;

  fixedWidthMatches.forEach((match) => {
    const width = parseInt(match.match(/(\d+)/)?.[1] || '0');
    if (width > 320) {
      fixedWidthElements++;
      if (width > 500) horizontalScrollRisk = true;
    }
  });

  if (horizontalScrollRisk) {
    issues.push('Fixed-width elements >500px cause horizontal scrolling on mobile');
    score -= 15;
  }

  // Responsive images
  const images = doc.querySelectorAll('img');
  const totalImages = images.length;
  let responsiveImagesCount = 0;

  images.forEach((img) => {
    if (img.hasAttribute('srcset') || img.closest('picture')) {
      responsiveImagesCount++;
    }
  });

  if (totalImages > 5 && responsiveImagesCount < totalImages * 0.3) {
    issues.push(`Only ${responsiveImagesCount}/${totalImages} images have srcset - loading large images on mobile`);
    score -= 10;
  }

  // Bonus points (reduced to not inflate scores)
  if (hasManifest) score += 3;
  if (hasThemeColor) score += 1;
  if (usesRelativeFontSizes) score += 2;

  return {
    hasViewport,
    viewportContent,
    hasWidthDeviceWidth,
    hasInitialScale,
    hasUserScalable,
    smallTapTargets,
    tapTargetsList,
    smallTextElements,
    usesRelativeFontSizes,
    hasMediaQueries,
    mediaQueryCount,
    hasFlexbox,
    hasGrid,
    horizontalScrollRisk,
    fixedWidthElements,
    hasThemeColor,
    hasAppleMobileWebAppCapable,
    hasAppleTouchIcon,
    hasManifest,
    responsiveImagesCount,
    totalImages,
    score: Math.max(0, Math.min(100, score)),
    issues
  };
}

// ============================================
// EXTERNAL RESOURCES
// ============================================

function analyzeExternalResources(doc: Document, sourceUrl: string): ExternalResourcesData {
  let sourceDomain = '';
  try {
    sourceDomain = new URL(sourceUrl).hostname;
  } catch {}

  const isThirdParty = (url: string): boolean => {
    try {
      const urlDomain = new URL(url, sourceUrl).hostname;
      return urlDomain !== sourceDomain;
    } catch {
      return false;
    }
  };

  const getDomain = (url: string): string => {
    try {
      return new URL(url, sourceUrl).hostname;
    } catch {
      return '';
    }
  };

  // CSS Files
  const stylesheets = doc.querySelectorAll('link[rel="stylesheet"]');
  const cssFiles: { url: string; isThirdParty: boolean }[] = [];

  stylesheets.forEach((link) => {
    const href = link.getAttribute('href');
    if (href) {
      cssFiles.push({
        url: href,
        isThirdParty: isThirdParty(href)
      });
    }
  });

  // JavaScript Files
  const scripts = doc.querySelectorAll('script[src]');
  const jsFiles: { url: string; isThirdParty: boolean; async: boolean; defer: boolean; module: boolean }[] = [];

  scripts.forEach((script) => {
    const src = script.getAttribute('src');
    if (src) {
      jsFiles.push({
        url: src,
        isThirdParty: isThirdParty(src),
        async: script.hasAttribute('async'),
        defer: script.hasAttribute('defer'),
        module: script.getAttribute('type') === 'module'
      });
    }
  });

  // Font Files
  const fontFiles: { url: string; format: string | null }[] = [];
  const googleFonts: string[] = [];

  // Check link tags for fonts
  doc.querySelectorAll('link[rel="preload"][as="font"], link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').forEach((link) => {
    const href = link.getAttribute('href');
    if (href) {
      if (href.includes('fonts.googleapis.com')) {
        // Extract font family names from Google Fonts URL
        const familyMatch = href.match(/family=([^&]+)/);
        if (familyMatch) {
          const families = familyMatch[1].split('|').map(f => f.split(':')[0].replace(/\+/g, ' '));
          googleFonts.push(...families);
        }
      }
      fontFiles.push({
        url: href,
        format: href.includes('.woff2') ? 'woff2' : href.includes('.woff') ? 'woff' : href.includes('.ttf') ? 'ttf' : null
      });
    }
  });

  // Also check @font-face in style tags
  const styleTags = doc.querySelectorAll('style');
  styleTags.forEach((style) => {
    const content = style.textContent || '';
    const fontFaceMatches = content.match(/url\(['"]?([^'")\s]+\.(woff2?|ttf|otf|eot))['"]?\)/gi) || [];
    fontFaceMatches.forEach((match) => {
      const urlMatch = match.match(/url\(['"]?([^'")\s]+)['"]?\)/);
      if (urlMatch) {
        fontFiles.push({
          url: urlMatch[1],
          format: urlMatch[1].includes('.woff2') ? 'woff2' : urlMatch[1].includes('.woff') ? 'woff' : 'other'
        });
      }
    });
  });

  // Collect all third-party domains
  const thirdPartyDomainsSet = new Set<string>();

  cssFiles.forEach((f) => {
    if (f.isThirdParty) thirdPartyDomainsSet.add(getDomain(f.url));
  });
  jsFiles.forEach((f) => {
    if (f.isThirdParty) thirdPartyDomainsSet.add(getDomain(f.url));
  });
  fontFiles.forEach((f) => {
    const domain = getDomain(f.url);
    if (domain && domain !== sourceDomain) thirdPartyDomainsSet.add(domain);
  });

  // Also check images for third-party domains
  doc.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (src && isThirdParty(src)) {
      thirdPartyDomainsSet.add(getDomain(src));
    }
  });

  const thirdPartyDomains = Array.from(thirdPartyDomainsSet).filter(Boolean);

  // Suggest preconnects for frequently used third-party domains
  const suggestedPreconnects: string[] = [];
  thirdPartyDomains.forEach((domain) => {
    // Check if already has preconnect
    const hasPreconnect = !!doc.querySelector(`link[rel="preconnect"][href*="${domain}"]`);
    if (!hasPreconnect && domain) {
      suggestedPreconnects.push(domain);
    }
  });

  return {
    cssFiles,
    cssCount: cssFiles.length,
    jsFiles,
    jsCount: jsFiles.length,
    fontFiles,
    fontCount: fontFiles.length,
    googleFonts: [...new Set(googleFonts)],
    thirdPartyDomains,
    thirdPartyCount: thirdPartyDomains.length,
    suggestedPreconnects: suggestedPreconnects.slice(0, 5)
  };
}

// ============================================
// COLLECT ISSUES
// ============================================

// Severity phrases in English
const SEVERITY_PHRASES = {
  critical: 'CRITICAL! Requires immediate attention.',
  high: 'High priority! Significantly impacts SEO.',
  medium: 'Medium priority. Recommended to fix.',
  low: 'Low priority. Nice to have improvement.'
};

function collectIssues(data: any): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const { technical, international, content, links, images, schema, social, accessibility, dom, performance, security, platform, mobile } = data;

  // Title - CRITICAL for SEO
  if (!technical.title.value) issues.push({ id: 'no-title', severity: 'critical', category: 'Technical', issue: 'Missing title tag', issueGe: 'Missing title tag', location: '<head>', fix: 'Add <title>Your Page Title</title> in <head>', fixGe: 'Add <title>Your Page Title</title> in <head>', details: `${SEVERITY_PHRASES.critical} Title tag is the most important SEO element. Google uses it in search results. Without it, the page cannot rank properly.` });
  else if (technical.title.length < 30) issues.push({ id: 'title-short', severity: 'high', category: 'Technical', issue: `Title too short (${technical.title.length} chars)`, issueGe: `Title too short (${technical.title.length} chars)`, location: `<title>${technical.title.value}</title>`, fix: 'Expand to 30-60 characters with keywords', fixGe: 'Expand to 30-60 characters with keywords', details: `${SEVERITY_PHRASES.high} Current: "${technical.title.value}". Short titles lose ranking potential. Add target keywords.` });
  else if (technical.title.length > 60) issues.push({ id: 'title-long', severity: 'medium', category: 'Technical', issue: `Title may be truncated (${technical.title.length} chars)`, issueGe: `Title may be truncated (${technical.title.length} chars)`, location: `<title>${technical.title.value}</title>`, fix: 'Keep important keywords in first 60 chars', fixGe: 'Keep important keywords in first 60 chars', details: `${SEVERITY_PHRASES.medium} Current: "${technical.title.value.substring(0, 70)}...". Google displays max 60 characters.` });

  // Meta description - Important for CTR
  if (!technical.metaDesc.value) issues.push({ id: 'no-meta-desc', severity: 'high', category: 'Technical', issue: 'Missing meta description', issueGe: 'Missing meta description', location: '<head>', fix: 'Add <meta name="description" content="...">', fixGe: 'Add <meta name="description" content="...">', details: `${SEVERITY_PHRASES.high} Meta description affects CTR (Click-Through Rate). Without it, Google will select text from the page, which may not be optimal.` });
  else if (technical.metaDesc.length < 120) issues.push({ id: 'meta-desc-short', severity: 'medium', category: 'Technical', issue: `Meta description short (${technical.metaDesc.length} chars)`, issueGe: `Meta description short (${technical.metaDesc.length} chars)`, location: `<meta name="description" content="${technical.metaDesc.value}">`, fix: 'Expand to 120-160 chars with call-to-action', fixGe: 'Expand to 120-160 chars with call-to-action', details: `${SEVERITY_PHRASES.medium} Current: "${technical.metaDesc.value}". Short descriptions fail to attract users. Add benefits and CTA.` });
  else if (technical.metaDesc.length > 160) issues.push({ id: 'meta-desc-long', severity: 'low', category: 'Technical', issue: `Meta description truncated (${technical.metaDesc.length} chars)`, issueGe: `Meta description truncated (${technical.metaDesc.length} chars)`, location: `<meta name="description" content="${technical.metaDesc.value.substring(0, 80)}...">`, fix: 'Keep under 160 chars', fixGe: 'Keep under 160 chars', details: `${SEVERITY_PHRASES.low} Google truncates 160+ chars with "...". Put key information at the beginning.` });

  // Canonical
  if (technical.canonical.count === 0) issues.push({ id: 'no-canonical', severity: 'medium', category: 'Technical', issue: 'Missing canonical tag', issueGe: 'Missing canonical tag', location: '<head>', fix: 'Add <link rel="canonical" href="...">', fixGe: 'Add <link rel="canonical" href="...">', details: `${SEVERITY_PHRASES.medium} Canonical tag tells Google which is the main version of the page. This prevents duplicate content issues.` });
  else if (technical.canonical.count > 1) issues.push({ id: 'multi-canonical', severity: 'critical', category: 'Technical', issue: `Multiple canonicals found (${technical.canonical.count})`, issueGe: `Multiple canonicals found (${technical.canonical.count})`, location: '<head>', fix: 'Keep only one canonical tag', fixGe: 'Keep only one canonical tag', details: `${SEVERITY_PHRASES.critical} Multiple canonical tags confuse Google. There should be only one canonical per page.` });
  else if (technical.canonical.isCrossDomain) issues.push({ id: 'cross-domain-canonical', severity: 'high', category: 'Technical', issue: 'Cross-domain canonical detected', issueGe: 'Cross-domain canonical detected', location: `<link rel="canonical" href="${technical.canonical.href}">`, fix: 'Verify this is intentional', fixGe: 'Verify this is intentional', details: `${SEVERITY_PHRASES.high} Canonical points to another domain: ${technical.canonical.href}. This means Google will not index this page.` });

  // Viewport
  if (!technical.viewport.content) issues.push({ id: 'no-viewport', severity: 'critical', category: 'Mobile', issue: 'Missing viewport meta tag', issueGe: 'Missing viewport meta tag', location: '<head>', fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">', fixGe: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">', details: `${SEVERITY_PHRASES.critical} Viewport is required for mobile devices. Without it, the page will display incorrectly on mobile and Google's Mobile-First indexing will be affected.` });
  else if (!technical.viewport.isMobileOptimized) issues.push({ id: 'viewport-not-mobile', severity: 'high', category: 'Mobile', issue: 'Viewport not mobile-optimized', issueGe: 'Viewport not mobile-optimized', location: `<meta name="viewport" content="${technical.viewport.content}">`, fix: 'Use width=device-width, initial-scale=1', fixGe: 'Use width=device-width, initial-scale=1', details: `${SEVERITY_PHRASES.high} Current viewport: "${technical.viewport.content}". Must contain width=device-width.` });

  // Language & Charset
  if (!technical.language) issues.push({ id: 'no-lang', severity: 'high', category: 'Accessibility', issue: 'Missing lang attribute on <html>', issueGe: 'Missing lang attribute on <html>', location: '<html>', fix: 'Add lang="en" or appropriate language code', fixGe: 'Add lang="en" or appropriate language code', details: `${SEVERITY_PHRASES.high} lang attribute helps browsers and screen readers determine language. Also important for international SEO.` });
  if (!technical.charset) issues.push({ id: 'no-charset', severity: 'medium', category: 'Technical', issue: 'Missing charset declaration', issueGe: 'Missing charset declaration', location: '<head>', fix: 'Add <meta charset="UTF-8">', fixGe: 'Add <meta charset="UTF-8">', details: `${SEVERITY_PHRASES.medium} Charset defines character encoding. UTF-8 is required for international characters.` });

  // Content language vs declared lang attribute mismatch - FIX: Handle regional variants like es-ES, en-US, etc.
  if (technical.language && content.detectedLanguage) {
    const declaredLang = technical.language.toLowerCase().split('-')[0]; // e.g., "es-ES" -> "es", "en-US" -> "en"
    // Map detected language to acceptable lang codes - FIXED: es matches es-ES, es-MX, etc.
    const langMap: Record<string, string[]> = {
      'ka': ['ka'], 'ru': ['ru'], 'de': ['de'], 'en': ['en'], 'es': ['es'], 'fr': ['fr'], 'it': ['it'], 'pt': ['pt'], 'nl': ['nl'], 'pl': ['pl'], 'ja': ['ja'], 'zh': ['zh'], 'ko': ['ko'], 'ar': ['ar'], 'tr': ['tr']
    };
    const expectedLangs = langMap[content.detectedLanguage] || [content.detectedLanguage];
    // FIX: Only flag if base language doesn't match (es-ES matches es content, en-US matches en content)
    if (!expectedLangs.includes(declaredLang)) {
      const langNames: Record<string, string> = { 'ka': 'Georgian', 'ru': 'Russian', 'de': 'German', 'en': 'English', 'es': 'Spanish', 'fr': 'French', 'it': 'Italian', 'pt': 'Portuguese', 'nl': 'Dutch', 'pl': 'Polish', 'ja': 'Japanese', 'zh': 'Chinese', 'ko': 'Korean', 'ar': 'Arabic', 'tr': 'Turkish' };
      issues.push({
        id: 'lang-content-mismatch',
        severity: 'high',
        category: 'International',
        issue: `Content language mismatch: declared "${technical.language}" but content is ${langNames[content.detectedLanguage] || content.detectedLanguage}`,
        issueGe: `Content language mismatch: declared "${technical.language}" but content is ${langNames[content.detectedLanguage] || content.detectedLanguage}`,
        location: `<html lang="${technical.language}">`,
        fix: `Change lang="${technical.language}" to lang="${content.detectedLanguage}"`,
        fixGe: `Change lang="${technical.language}" to lang="${content.detectedLanguage}"`,
        details: `${SEVERITY_PHRASES.high} Page content is in ${langNames[content.detectedLanguage] || content.detectedLanguage}, but HTML lang attribute indicates "${technical.language}". This confuses search engines and screen readers.`
      });
    }
  }

  // Title vs Content language mismatch (German title but English content, etc.)
  if (content.titleContentLangMismatch && content.titleLanguage && content.detectedLanguage) {
    const langNames: Record<string, string> = { 'ka': 'Georgian', 'ru': 'Russian', 'de': 'German', 'en': 'English', 'es': 'Spanish', 'fr': 'French', 'it': 'Italian', 'pt': 'Portuguese' };
    issues.push({
      id: 'title-content-lang-mismatch',
      severity: 'high',
      category: 'Content',
      issue: `Title language (${langNames[content.titleLanguage] || content.titleLanguage}) differs from content language (${langNames[content.detectedLanguage] || content.detectedLanguage})`,
      issueGe: `Title language (${langNames[content.titleLanguage] || content.titleLanguage}) differs from content language (${langNames[content.detectedLanguage] || content.detectedLanguage})`,
      location: `<title>${technical.title.value}</title>`,
      fix: 'Use same language for title and content',
      fixGe: 'Use same language for title and content',
      details: `${SEVERITY_PHRASES.high} Title is in ${langNames[content.titleLanguage] || content.titleLanguage}, but page content is in ${langNames[content.detectedLanguage] || content.detectedLanguage}. This confuses users and search engines.`
    });
  }

  // Robots
  if (technical.robots.hasNoindex) issues.push({ id: 'noindex', severity: 'critical', category: 'Technical', issue: 'Page blocked from indexing (noindex)', issueGe: 'Page blocked from indexing (noindex)', location: `<meta name="robots" content="${technical.robots.meta}">`, fix: 'Remove noindex if page should be indexed', fixGe: 'Remove noindex if page should be indexed', details: `${SEVERITY_PHRASES.critical} noindex meta tag blocks page indexing in Google. Page will not appear in search results!` });

  // llms.txt
  if (!technical.llmsTxt.found && !technical.llmsTxt.mentioned) issues.push({ id: 'no-llms-txt', severity: 'low', category: 'AI', issue: 'No llms.txt file found', issueGe: 'No llms.txt file found', location: '/llms.txt', fix: 'Create llms.txt for AI crawler guidance', fixGe: 'Create llms.txt for AI crawler guidance', details: `${SEVERITY_PHRASES.low} llms.txt is a new standard for AI crawlers (ChatGPT, Claude, etc.). Adding it helps AI systems better understand your site.` });

  // Headings
  if (content.headings.h1.length === 0) issues.push({ id: 'no-h1', severity: 'high', category: 'Content', issue: 'No H1 heading found', issueGe: 'No H1 heading found', location: '<body>', fix: 'Add one H1 heading describing page content', fixGe: 'Add one H1 heading describing page content', details: `${SEVERITY_PHRASES.high} H1 is the main heading of the page. Every page should have exactly one H1 that describes the page content.` });
  else if (content.headings.h1.length > 1) issues.push({ id: 'multi-h1', severity: 'low', category: 'Content', issue: `Multiple H1 headings (${content.headings.h1.length})`, issueGe: `Multiple H1 headings (${content.headings.h1.length})`, location: content.headings.h1.slice(0, 2).map((h: string) => `<h1>${h.substring(0, 50)}</h1>`).join(' '), fix: 'Use only one H1, use H2-H6 for subheadings', fixGe: 'Use only one H1, use H2-H6 for subheadings', details: `${SEVERITY_PHRASES.low} Found H1s: ${content.headings.h1.slice(0, 3).map((h: string) => `"${h.substring(0, 40)}"`).join(', ')}. One H1 is recommended.` });
  if (content.titleH1Duplicate) issues.push({ id: 'title-h1-same', severity: 'low', category: 'Content', issue: 'Title and H1 are identical', issueGe: 'Title and H1 are identical', location: `<title>${technical.title.value}</title> and <h1>${content.headings.h1[0]?.substring(0, 50)}</h1>`, fix: 'Make H1 slightly different from title', fixGe: 'Make H1 slightly different from title', details: `${SEVERITY_PHRASES.low} Title and H1 are the same: "${technical.title.value}". Different text provides more keyword opportunities.` });
  if (accessibility.skippedHeadings.length > 0) issues.push({ id: 'skipped-headings', severity: 'medium', category: 'Accessibility', issue: `Heading levels skipped: ${accessibility.skippedHeadings.join(', ')}`, issueGe: `Heading levels skipped: ${accessibility.skippedHeadings.join(', ')}`, location: '<h1>-<h6>', fix: 'Use sequential heading levels (H1→H2→H3)', fixGe: 'Use sequential heading levels (H1→H2→H3)', details: `${SEVERITY_PHRASES.medium} Skipped levels: ${accessibility.skippedHeadings.join(', ')}. Headings should be sequential (H1→H2→H3) for screen readers.` });

  // Content & Readability
  if (content.wordCount < 300) issues.push({ id: 'thin-content', severity: 'high', category: 'Content', issue: `Thin content (${content.wordCount} words)`, issueGe: `Thin content (${content.wordCount} words)`, location: '<body>', fix: 'Add more valuable content (300+ words recommended)', fixGe: 'Add more valuable content (300+ words recommended)', details: `${SEVERITY_PHRASES.high} Page has only ${content.wordCount} words. Google prefers comprehensive, detailed content.` });
  if (content.readability.fleschScore > 0 && content.readability.fleschScore < 30) issues.push({ id: 'hard-to-read', severity: 'medium', category: 'Content', issue: `Hard to read (Flesch: ${content.readability.fleschScore})`, issueGe: `Hard to read (Flesch: ${content.readability.fleschScore})`, location: '<body>', fix: 'Use shorter sentences and simpler words', fixGe: 'Use shorter sentences and simpler words', details: `${SEVERITY_PHRASES.medium} Flesch score: ${content.readability.fleschScore}/100 (${content.readability.fleschGrade}). Average sentence length: ${content.readability.avgSentenceLength} words. Simplify the text.` });
  if (content.aiScore > 50) issues.push({ id: 'ai-content', severity: 'medium', category: 'Content', issue: `Possible AI-generated content (Score: ${content.aiScore})`, issueGe: `Possible AI-generated content (Score: ${content.aiScore})`, location: '<body>', fix: 'Humanize content, add personal insights and unique perspectives', fixGe: 'Humanize content, add personal insights and unique perspectives', details: `${SEVERITY_PHRASES.medium} Found AI patterns: ${content.aiPhrases.slice(0, 5).join(', ')}. Google may reduce rankings for AI-generated content without human value-add.` });

  // Hreflang
  if (international.hreflangs.length > 0) {
    if (!international.hasXDefault) issues.push({ id: 'no-x-default', severity: 'medium', category: 'International', issue: 'Missing hreflang x-default', issueGe: 'Missing hreflang x-default', location: '<head>', fix: 'Add <link rel="alternate" hreflang="x-default" href="...">', fixGe: 'Add <link rel="alternate" hreflang="x-default" href="...">', details: `${SEVERITY_PHRASES.medium} x-default indicates the default page for users whose language is not in the list.` });
    if (!international.hasSelfReference) issues.push({ id: 'no-self-hreflang', severity: 'high', category: 'International', issue: 'Missing self-referencing hreflang', issueGe: 'Missing self-referencing hreflang', location: '<head>', fix: 'Add hreflang pointing to current page', fixGe: 'Add hreflang pointing to current page', details: `${SEVERITY_PHRASES.high} All hreflang sets must include a self-referencing link to the current page.` });
    if (!international.canonicalInHreflang) issues.push({ id: 'canonical-not-in-hreflang', severity: 'high', category: 'International', issue: 'Canonical URL missing from hreflang set', issueGe: 'Canonical URL missing from hreflang set', location: '<head>', fix: 'Add canonical URL to hreflang set', fixGe: 'Add canonical URL to hreflang set', details: `${SEVERITY_PHRASES.high} Canonical URL must be in the hreflang set.` });
    if (!international.langMatchesHreflang) issues.push({ id: 'lang-mismatch', severity: 'medium', category: 'International', issue: 'HTML lang not matching hreflang', issueGe: 'HTML lang not matching hreflang', location: `<html lang="${technical.language}">`, fix: 'Ensure lang attribute matches a hreflang', fixGe: 'Ensure lang attribute matches a hreflang', details: `${SEVERITY_PHRASES.medium} HTML lang="${technical.language}" doesn't match any hreflang value.` });

    // Duplicate hreflang languages
    if (international.duplicateHreflangs && international.duplicateHreflangs.length > 0) {
      issues.push({ id: 'duplicate-hreflangs', severity: 'high', category: 'International', issue: `Duplicate hreflang languages: ${international.duplicateHreflangs.join(', ')}`, issueGe: `Duplicate hreflang languages: ${international.duplicateHreflangs.join(', ')}`, location: '<head>', fix: 'Remove duplicate hreflang entries - each language should appear only once', fixGe: 'Remove duplicate hreflang entries - each language should appear only once', details: `${SEVERITY_PHRASES.high} Same language hreflang is specified multiple times. This confuses Google.` });
    }

    // Hreflangs pointing to non-canonical URLs
    if (international.nonCanonicalHreflangs && international.nonCanonicalHreflangs.length > 0) {
      issues.push({ id: 'hreflang-non-canonical', severity: 'high', category: 'International', issue: `Hreflang URLs may not be canonical`, issueGe: `Hreflang URLs may not be canonical`, location: '<head>', fix: 'Hreflang URLs should be clean canonical URLs without query params or fragments', fixGe: 'Hreflang URLs should be clean canonical URLs without query params or fragments', details: `${SEVERITY_PHRASES.high} Issues: ${international.nonCanonicalHreflangs.slice(0, 5).join('; ')}` });
    }

    international.issues.forEach((issue: string, i: number) => issues.push({ id: `hreflang-${i}`, severity: 'high', category: 'International', issue, issueGe: issue, location: '<head>', fix: 'Fix hreflang configuration', fixGe: 'Fix hreflang configuration', details: `${SEVERITY_PHRASES.high} ${issue}` }));
  }

  // Images - Show full HTML tags
  if (images.withoutAlt > 0) {
    const imgExamples = images.withoutAltList?.slice(0, 3).map((img: any) => `<img src="${img.src?.substring(0, 50)}${img.src?.length > 50 ? '...' : ''}">`).join(' ') || '<img>';
    issues.push({ id: 'img-no-alt', severity: images.withoutAlt > 5 ? 'high' : 'medium', category: 'Accessibility', issue: `${images.withoutAlt} image(s) missing alt text`, issueGe: `${images.withoutAlt} image(s) missing alt text`, location: imgExamples, fix: 'Add descriptive alt text to all images', fixGe: 'Add descriptive alt text to all images', details: `${images.withoutAlt > 5 ? SEVERITY_PHRASES.high : SEVERITY_PHRASES.medium} ${images.withoutAlt} images missing alt attribute. Alt text is required for accessibility and image SEO.` });
  }
  if (images.withoutDimensions > 0) {
    const imgExamples = images.withoutDimensionsList?.slice(0, 2).map((img: any) => `<img src="${img.src?.substring(0, 40)}..." alt="${img.alt?.substring(0, 20) || ''}">`).join(' ') || '<img>';
    issues.push({ id: 'img-no-dim', severity: 'medium', category: 'Performance', issue: `${images.withoutDimensions} image(s) without dimensions`, issueGe: `${images.withoutDimensions} image(s) without dimensions`, location: imgExamples, fix: 'Add width and height attributes', fixGe: 'Add width and height attributes', details: `${SEVERITY_PHRASES.medium} Specifying image dimensions prevents CLS (Cumulative Layout Shift) and improves Core Web Vitals.` });
  }
  if (images.brokenCount > 0) {
    const brokenExamples = images.brokenList?.slice(0, 3).map((img: any) => `<img src="${img.src}" alt="${img.alt || ''}">`).join(' ') || '<img src="">';
    issues.push({ id: 'broken-images', severity: 'high', category: 'Images', issue: `${images.brokenCount} broken/invalid image(s) found`, issueGe: `${images.brokenCount} broken/invalid image(s) found`, location: brokenExamples, fix: 'Fix or remove broken image sources', fixGe: 'Fix or remove broken image sources', details: `${SEVERITY_PHRASES.high} Broken images: ${images.brokenList?.slice(0, 5).map((img: any) => `"${img.alt || 'no alt'}" (src: ${img.src})`).join('; ')}. Empty or invalid src damages UX.` });
  }
  if (images.lazyAboveFold > 0) issues.push({ id: 'lazy-above-fold', severity: 'medium', category: 'Performance', issue: `${images.lazyAboveFold} above-fold image(s) with lazy loading`, issueGe: `${images.lazyAboveFold} above-fold image(s) with lazy loading`, location: '<img loading="lazy">', fix: 'Remove lazy loading from above-fold images', fixGe: 'Remove lazy loading from above-fold images', details: `${SEVERITY_PHRASES.medium} First 1-3 images (above-fold) should not be lazy-loaded as this slows LCP (Largest Contentful Paint).` });

  // Links - Show full HTML tags with href and anchor text
  if (links.broken > 0) {
    const linkExamples = links.brokenList?.slice(0, 3).map((l: any) => `<a href="${l.href}">${l.text || '(empty)'}</a>`).join(' ') || '<a href="">';
    issues.push({ id: 'broken-links', severity: 'high', category: 'Links', issue: `${links.broken} empty/invalid link(s) found`, issueGe: `${links.broken} empty/invalid link(s) found`, location: linkExamples, fix: 'Add valid href URLs or remove links', fixGe: 'Add valid href URLs or remove links', details: `${SEVERITY_PHRASES.high} Problematic links found. Empty href or javascript:void(0) damages UX and SEO.` });
  }
  if (links.genericAnchors > 0) {
    const genericExamples = links.genericAnchorsList?.slice(0, 3).map((l: any) => `<a href="${l.href?.substring(0, 40)}">${l.text}</a>`).join(' ') || '<a>click here</a>';
    issues.push({ id: 'generic-anchors', severity: 'medium', category: 'Links', issue: `${links.genericAnchors} link(s) with generic anchor text`, issueGe: `${links.genericAnchors} link(s) with generic anchor text`, location: genericExamples, fix: 'Use descriptive anchor text', fixGe: 'Use descriptive anchor text', details: `${SEVERITY_PHRASES.medium} Generic anchors like "click here", "more" don't give Google context about the linked page.` });
  }
  if (links.unsafeExternalCount > 0) issues.push({ id: 'unsafe-external', severity: 'medium', category: 'Security', issue: `${links.unsafeExternalCount} external link(s) missing rel="noopener"`, issueGe: `${links.unsafeExternalCount} external link(s) missing rel="noopener"`, location: '<a target="_blank" href="...">', fix: 'Add rel="noopener noreferrer" to external links', fixGe: 'Add rel="noopener noreferrer" to external links', details: `${SEVERITY_PHRASES.medium} target="_blank" links need rel="noopener" for security (Tabnabbing attack prevention).` });

  // Schema
  if (schema.count === 0) issues.push({ id: 'no-schema', severity: 'medium', category: 'SEO', issue: 'No structured data (Schema.org) found', issueGe: 'No structured data (Schema.org) found', location: '<script type="application/ld+json">', fix: 'Add Schema.org markup (Organization, WebPage, etc.)', fixGe: 'Add Schema.org markup (Organization, WebPage, etc.)', details: `${SEVERITY_PHRASES.medium} Schema.org markup helps Google understand page content and can enable Rich Snippets in search.` });
  if (schema.invalid > 0) issues.push({ id: 'invalid-schema', severity: 'critical', category: 'Schema', issue: `${schema.invalid} schema block(s) with invalid JSON`, issueGe: `${schema.invalid} schema block(s) with invalid JSON`, location: '<script type="application/ld+json">', fix: 'Fix JSON syntax errors', fixGe: 'Fix JSON syntax errors', details: `${SEVERITY_PHRASES.critical} Invalid JSON syntax. Google cannot read schema data. Validate with JSON validator.` });
  if (schema.missingContext > 0) issues.push({ id: 'schema-no-context', severity: 'high', category: 'Schema', issue: `${schema.missingContext} schema block(s) missing @context`, issueGe: `${schema.missingContext} schema block(s) missing @context`, location: '<script type="application/ld+json">', fix: 'Add "@context": "https://schema.org"', fixGe: 'Add "@context": "https://schema.org"', details: `${SEVERITY_PHRASES.high} @context is required for Schema.org to work properly.` });
  schema.details.forEach((s: SchemaItem) => { if (s.issues.length > 0 && s.type !== 'Invalid JSON') issues.push({ id: `schema-${s.index}`, severity: 'high', category: 'Schema', issue: `${s.type}: ${s.issues.join(', ')}`, issueGe: `${s.type}: ${s.issues.join(', ')}`, location: `Schema #${s.index}`, fix: 'Add required fields', fixGe: 'Add required fields', details: `${SEVERITY_PHRASES.high} ${s.type} schema is missing: ${s.issues.join(', ')}` }); });

  // Social
  if (!social.isComplete) { const missing = [!social.og.title && 'og:title', !social.og.description && 'og:description', !social.og.image && 'og:image', !social.og.url && 'og:url'].filter(Boolean); issues.push({ id: 'incomplete-og', severity: 'medium', category: 'Social', issue: `Missing Open Graph tags: ${missing.join(', ')}`, issueGe: `Missing Open Graph tags: ${missing.join(', ')}`, location: '<meta property="og:*">', fix: 'Add all required OG tags', fixGe: 'Add all required OG tags', details: `${SEVERITY_PHRASES.medium} Missing: ${missing.join(', ')}. Open Graph tags control how the page appears when shared on Facebook and other social networks.` }); }
  if (!social.twitter.card) issues.push({ id: 'no-twitter-card', severity: 'low', category: 'Social', issue: 'Missing Twitter Card meta tags', issueGe: 'Missing Twitter Card meta tags', location: '<meta name="twitter:card">', fix: 'Add Twitter Card tags', fixGe: 'Add Twitter Card tags', details: `${SEVERITY_PHRASES.low} Twitter Card tags control how the page appears when shared on Twitter/X.` });

  // Accessibility & ARIA
  if (accessibility.buttonsWithoutLabel > 0) issues.push({ id: 'btn-no-label', severity: 'medium', category: 'Accessibility', issue: `${accessibility.buttonsWithoutLabel} button(s) without accessible label`, issueGe: `${accessibility.buttonsWithoutLabel} button(s) without accessible label`, location: '<button></button>', fix: 'Add text content or aria-label', fixGe: 'Add text content or aria-label', details: `${SEVERITY_PHRASES.medium} Buttons need accessible text for screen readers.` });
  if (accessibility.inputsWithoutLabel > 0) issues.push({ id: 'input-no-label', severity: 'medium', category: 'Accessibility', issue: `${accessibility.inputsWithoutLabel} input(s) without label`, issueGe: `${accessibility.inputsWithoutLabel} input(s) without label`, location: '<input>', fix: 'Add <label> element or aria-label', fixGe: 'Add <label> element or aria-label', details: `${SEVERITY_PHRASES.medium} Form fields need <label> for accessibility.` });
  if (accessibility.linksWithoutText > 0) issues.push({ id: 'link-no-text', severity: 'medium', category: 'Accessibility', issue: `${accessibility.linksWithoutText} link(s) without text content`, issueGe: `${accessibility.linksWithoutText} link(s) without text content`, location: '<a href="..."></a>', fix: 'Add link text or aria-label', fixGe: 'Add link text or aria-label', details: `${SEVERITY_PHRASES.medium} Links need text content so screen readers can read them.` });
  if (accessibility.aria.missingLandmarks.length > 0) issues.push({ id: 'missing-landmarks', severity: 'medium', category: 'Accessibility', issue: `Missing ARIA landmarks: ${accessibility.aria.missingLandmarks.join(', ')}`, issueGe: `Missing ARIA landmarks: ${accessibility.aria.missingLandmarks.join(', ')}`, location: '<main>, <nav>', fix: 'Add semantic landmark elements', fixGe: 'Add semantic landmark elements', details: `${SEVERITY_PHRASES.medium} Missing: ${accessibility.aria.missingLandmarks.join(', ')}. ARIA landmarks (<main>, <nav>, <header>) help screen readers with navigation.` });

  // DOM
  if (dom.maxDepth > 32) issues.push({ id: 'deep-dom', severity: 'medium', category: 'Performance', issue: `DOM nesting too deep (${dom.maxDepth} levels)`, issueGe: `DOM nesting too deep (${dom.maxDepth} levels)`, location: 'DOM Structure', fix: 'Flatten nested HTML structure', fixGe: 'Flatten nested HTML structure', details: `${SEVERITY_PHRASES.medium} Deep DOM structure slows rendering. Recommended max: 32 levels.` });
  if (dom.totalElements > 1500) issues.push({ id: 'large-dom', severity: 'medium', category: 'Performance', issue: `Large DOM size (${dom.totalElements} elements)`, issueGe: `Large DOM size (${dom.totalElements} elements)`, location: 'DOM Structure', fix: 'Reduce DOM elements, use virtualization', fixGe: 'Reduce DOM elements, use virtualization', details: `${SEVERITY_PHRASES.medium} Large DOM slows JavaScript execution and rendering. Recommended: <1500 elements.` });
  if (dom.duplicateIds.length > 0) issues.push({ id: 'duplicate-ids', severity: 'high', category: 'Accessibility', issue: `Duplicate element IDs found: ${dom.duplicateIds.slice(0, 3).join(', ')}`, issueGe: `Duplicate element IDs found: ${dom.duplicateIds.slice(0, 3).join(', ')}`, location: dom.duplicateIds.slice(0, 2).map((dupId: string) => `id="${dupId}"`).join(', '), fix: 'Make all IDs unique', fixGe: 'Make all IDs unique', details: `${SEVERITY_PHRASES.high} Duplicate IDs: ${dom.duplicateIds.slice(0, 5).join(', ')}. IDs must be unique in HTML.` });
  if (dom.deprecatedElements.length > 0) issues.push({ id: 'deprecated', severity: 'low', category: 'Technical', issue: `Deprecated HTML elements found: ${dom.deprecatedElements.join(', ')}`, issueGe: `Deprecated HTML elements found: ${dom.deprecatedElements.join(', ')}`, location: dom.deprecatedElements.slice(0, 3).map((el: string) => `<${el}>`).join(', '), fix: 'Replace with modern semantic tags', fixGe: 'Replace with modern semantic tags', details: `${SEVERITY_PHRASES.low} Found deprecated elements: ${dom.deprecatedElements.join(', ')}. Use CSS and modern HTML instead.` });

  // Performance
  if (performance.renderBlockingScripts > 3) issues.push({ id: 'render-blocking', severity: 'medium', category: 'Performance', issue: `${performance.renderBlockingScripts} render-blocking scripts in <head>`, issueGe: `${performance.renderBlockingScripts} render-blocking scripts in <head>`, location: '<head><script src="..."></script>', fix: 'Add async or defer attribute to scripts', fixGe: 'Add async or defer attribute to scripts', details: `${SEVERITY_PHRASES.medium} Render-blocking scripts slow page load. Use async/defer or move to before </body>.` });
  if (performance.preloadsWithoutAs > 0) issues.push({ id: 'preload-no-as', severity: 'medium', category: 'Performance', issue: `${performance.preloadsWithoutAs} preload link(s) missing "as" attribute`, issueGe: `${performance.preloadsWithoutAs} preload link(s) missing "as" attribute`, location: '<link rel="preload" href="...">', fix: 'Add as="script|style|font|image"', fixGe: 'Add as="script|style|font|image"', details: `${SEVERITY_PHRASES.medium} preload needs "as" attribute for correct prioritization.` });

  // Security
  if (security.mixedContentCount > 0) issues.push({ id: 'mixed-content', severity: 'critical', category: 'Security', issue: `${security.mixedContentCount} HTTP resource(s) on HTTPS page`, issueGe: `${security.mixedContentCount} HTTP resource(s) on HTTPS page`, location: security.mixedContentUrls.slice(0, 2).map((url: string) => `src="${url}"`).join(', '), fix: 'Change all resources to HTTPS', fixGe: 'Change all resources to HTTPS', details: `${SEVERITY_PHRASES.critical} Mixed content blocks resources and shows security warning. Problematic URLs: ${security.mixedContentUrls.slice(0, 3).join(', ')}` });

  // Platform
  if (platform.isCSR) issues.push({ id: 'csr', severity: 'high', category: 'Technical', issue: 'Page appears to be Client-Side Rendered', issueGe: 'Page appears to be Client-Side Rendered', location: '<body>', fix: 'Consider Server-Side Rendering (SSR) for SEO', fixGe: 'Consider Server-Side Rendering (SSR) for SEO', details: `${SEVERITY_PHRASES.high} CSR pages are harder for Google to index. Use SSR or SSG with Next.js/Nuxt.js.` });

  // Favicon
  if (!technical.favicon) issues.push({ id: 'no-favicon', severity: 'low', category: 'Technical', issue: 'No favicon found', issueGe: 'No favicon found', location: '<head>', fix: 'Add <link rel="icon" href="/favicon.ico">', fixGe: 'Add <link rel="icon" href="/favicon.ico">', details: `${SEVERITY_PHRASES.low} Favicon appears in browser tab and bookmarks. Essential for professional image.` });

  // Mobile Friendliness
  if (mobile && mobile.score < 50) issues.push({ id: 'mobile-poor', severity: 'critical', category: 'Mobile', issue: `Poor mobile friendliness score (${mobile.score}/100)`, issueGe: `Poor mobile friendliness score (${mobile.score}/100)`, location: 'Page', fix: 'Fix mobile issues: viewport, tap targets, responsive design', fixGe: 'Fix mobile issues: viewport, tap targets, responsive design', details: `${SEVERITY_PHRASES.critical} Mobile traffic is 60%+. Low mobile score directly hurts rankings. Issues: ${mobile.issues.slice(0, 3).join('; ')}` });
  else if (mobile && mobile.score < 70) issues.push({ id: 'mobile-needs-work', severity: 'high', category: 'Mobile', issue: `Mobile friendliness needs improvement (${mobile.score}/100)`, issueGe: `Mobile friendliness needs improvement (${mobile.score}/100)`, location: 'Page', fix: 'Improve responsive design and tap targets', fixGe: 'Improve responsive design and tap targets', details: `${SEVERITY_PHRASES.high} Issues: ${mobile.issues.slice(0, 3).join('; ')}` });

  if (mobile && mobile.smallTapTargets > 10) issues.push({ id: 'small-tap-targets', severity: 'high', category: 'Mobile', issue: `${mobile.smallTapTargets} small tap targets detected`, issueGe: `${mobile.smallTapTargets} small tap targets detected`, location: 'Links/Buttons', fix: 'Ensure tap targets are at least 48x48px with 8px spacing', fixGe: 'Ensure tap targets are at least 48x48px with 8px spacing', details: `${SEVERITY_PHRASES.high} Users cannot tap small elements on mobile. Google recommends: minimum 48x48px.` });

  if (mobile && mobile.horizontalScrollRisk) issues.push({ id: 'horizontal-scroll', severity: 'high', category: 'Mobile', issue: 'Page may require horizontal scrolling on mobile', issueGe: 'Page may require horizontal scrolling on mobile', location: 'Fixed-width elements', fix: 'Use max-width: 100% and responsive units', fixGe: 'Use max-width: 100% and responsive units', details: `${SEVERITY_PHRASES.high} Fixed-width elements cause horizontal scrolling. Use % or vw units.` });

  if (mobile && !mobile.hasMediaQueries && !mobile.hasFlexbox && !mobile.hasGrid) issues.push({ id: 'no-responsive', severity: 'high', category: 'Mobile', issue: 'No responsive design detected', issueGe: 'No responsive design detected', location: 'CSS', fix: 'Add media queries or use flexbox/grid', fixGe: 'Add media queries or use flexbox/grid', details: `${SEVERITY_PHRASES.high} Responsive design is essential for mobile devices. Use @media queries, flexbox, or CSS grid.` });

  if (mobile && mobile.hasUserScalable) issues.push({ id: 'no-zoom', severity: 'medium', category: 'Accessibility', issue: 'Zooming is disabled (user-scalable=no)', issueGe: 'Zooming is disabled (user-scalable=no)', location: '<meta name="viewport" content="...user-scalable=no...">', fix: 'Remove user-scalable=no from viewport', fixGe: 'Remove user-scalable=no from viewport', details: `${SEVERITY_PHRASES.medium} Disabling zoom hurts users with vision problems. WCAG requires zoom capability.` });

  return issues;
}

// ============================================
// CORE WEB VITALS ESTIMATION
// ============================================

function analyzeCoreWebVitals(doc: Document, images: any, performance: any, dom: any): any {
  const lcpIssues: string[] = [];
  const clsIssues: string[] = [];
  const fidIssues: string[] = [];

  // LCP Risk Analysis
  let lcpRisk: 'low' | 'medium' | 'high' = 'low';
  const heroImage = doc.querySelector('img[src]:not([loading="lazy"])');
  const heroImageOptimized = heroImage ? (heroImage.hasAttribute('fetchpriority') || heroImage.hasAttribute('decoding')) : true;

  if (images.withoutDimensions > 5) { lcpRisk = 'high'; lcpIssues.push('Many images without dimensions'); }
  else if (images.withoutDimensions > 0) { lcpRisk = 'medium'; lcpIssues.push(`${images.withoutDimensions} images without dimensions`); }

  if (performance.renderBlockingScripts > 3) { lcpRisk = 'high'; lcpIssues.push('Multiple render-blocking scripts'); }
  if (performance.fontsWithoutDisplay > 0) { lcpIssues.push('Fonts without display:swap'); }
  if (!heroImageOptimized && heroImage) { lcpIssues.push('Hero image not optimized (no fetchpriority)'); }

  // CLS Risk Analysis
  let clsRisk: 'low' | 'medium' | 'high' = 'low';
  const dynamicContent = doc.querySelectorAll('[data-src], [data-lazy], [data-load], [data-component], [class*="lazy"], [class*="dynamic"]').length;

  if (images.withoutDimensions > 3) { clsRisk = 'medium'; clsIssues.push('Images without explicit dimensions cause layout shift'); }
  if (images.withoutDimensions > 10) { clsRisk = 'high'; }
  if (performance.webFonts > 3) { clsIssues.push('Multiple web fonts may cause FOIT/FOUT'); }
  if (dynamicContent > 10) { clsIssues.push('Dynamic content may cause layout shifts'); }

  // FID/INP Risk Analysis
  let fidRisk: 'low' | 'medium' | 'high' = 'low';
  const longTasks = dom.inlineScripts > 5 ? dom.inlineScripts : 0;
  const thirdPartyScripts = performance.totalScripts - dom.inlineScripts;

  if (performance.totalScripts > 15) { fidRisk = 'high'; fidIssues.push('Too many scripts blocking main thread'); }
  else if (performance.totalScripts > 8) { fidRisk = 'medium'; fidIssues.push('Multiple scripts may delay interactivity'); }
  if (longTasks > 3) { fidIssues.push('Large inline scripts may cause long tasks'); }
  if (thirdPartyScripts > 5) { fidIssues.push('Third-party scripts impacting performance'); }

  // Calculate score
  const riskScores = { low: 100, medium: 70, high: 40 };
  const score = Math.round((riskScores[lcpRisk] + riskScores[clsRisk] + riskScores[fidRisk]) / 3);

  return {
    lcpRisk, lcpIssues, largestImage: heroImage?.getAttribute('src') || undefined, heroImageOptimized,
    clsRisk, clsIssues, imagesWithoutDimensions: images.withoutDimensions, dynamicContent,
    fidRisk, fidIssues, longTasks, thirdPartyScripts,
    score
  };
}

// ============================================
// URL STRUCTURE ANALYSIS
// ============================================

function analyzeUrlStructure(sourceUrl: string): any {
  const issues: string[] = [];
  let parsed: URL;

  try {
    parsed = new URL(sourceUrl);
  } catch {
    return { url: sourceUrl, length: sourceUrl.length, isOptimal: false, hasQueryParams: false, queryParamCount: 0, isDynamic: false, hasUnderscores: false, hasUppercase: false, depth: 0, hasTrailingSlash: false, hasFileExtension: false, issues: ['Invalid URL format'] };
  }

  const path = parsed.pathname;
  const length = sourceUrl.length;
  const hasQueryParams = parsed.search.length > 0;
  const queryParamCount = Array.from(parsed.searchParams).length;
  const isDynamic = /[?&](id|page|p|cat|category|tag|s|q|query|search|sid|session)=/i.test(sourceUrl);
  const hasUnderscores = path.includes('_');
  const hasUppercase = /[A-Z]/.test(path);
  const depth = path.split('/').filter(s => s).length;
  const hasTrailingSlash = path.endsWith('/') && path !== '/';
  const hasFileExtension = /\.(html|htm|php|asp|aspx|jsp)$/i.test(path);

  if (length > 100) issues.push('URL too long (>100 chars)');
  else if (length > 75) issues.push('URL length suboptimal (>75 chars)');
  if (hasQueryParams && queryParamCount > 3) issues.push('Too many query parameters');
  if (isDynamic) issues.push('Dynamic URL with session/ID parameters');
  if (hasUnderscores) issues.push('Use hyphens instead of underscores');
  if (hasUppercase) issues.push('URL contains uppercase letters');
  if (depth > 4) issues.push('URL too deep (>4 levels)');
  if (hasFileExtension) issues.push('URL has file extension (consider clean URLs)');

  return {
    url: sourceUrl, length, isOptimal: length <= 75 && !hasQueryParams && !hasUnderscores && !hasUppercase && depth <= 4,
    hasQueryParams, queryParamCount, isDynamic, hasUnderscores, hasUppercase, depth, hasTrailingSlash, hasFileExtension, issues
  };
}

// ============================================
// CRAWL DATA ANALYSIS
// ============================================

function analyzeCrawl(doc: Document, technical: any, content: any): any {
  const indexabilityIssues: string[] = [];
  const canonicalIssues: string[] = [];

  // Indexability
  const metaRobots = doc.querySelector('meta[name="robots"]')?.getAttribute('content') || null;
  const xRobotsTag = technical.robots?.xRobotsTag || null;
  const hasNoindex = metaRobots?.toLowerCase().includes('noindex') || xRobotsTag?.toLowerCase().includes('noindex');
  const hasNofollow = metaRobots?.toLowerCase().includes('nofollow');

  if (hasNoindex) indexabilityIssues.push('Page has noindex directive');
  if (hasNofollow) indexabilityIssues.push('Page has nofollow directive');
  if (technical.robotsTxt?.blocksAll) indexabilityIssues.push('robots.txt blocks all crawlers');

  // Canonicalization
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
  const selfCanonical = canonical === technical.canonical?.href;
  if (!canonical) canonicalIssues.push('Missing canonical tag');
  if (technical.canonical?.count > 1) canonicalIssues.push('Multiple canonical tags');
  if (technical.canonical?.isCrossDomain) canonicalIssues.push('Cross-domain canonical');

  // Pagination
  const relPrev = doc.querySelector('link[rel="prev"]');
  const relNext = doc.querySelector('link[rel="next"]');
  const hasPagination = !!(relPrev || relNext || doc.querySelector('.pagination, .pager, nav[aria-label*="pagination"]'));
  let paginationMethod: string | undefined;
  if (relPrev || relNext) paginationMethod = 'rel-prev-next';
  else if (doc.querySelector('[class*="load-more"], [data-load-more]')) paginationMethod = 'load-more';
  else if (doc.querySelector('[class*="infinite"], [data-infinite]')) paginationMethod = 'infinite-scroll';
  else if (hasPagination) paginationMethod = 'numbered';

  // Thin content / Soft 404 risk
  const thinContent = content.wordCount < 300;
  const softFourOFourRisk = thinContent && (content.headings.h1.length === 0 || content.headings.h1[0]?.toLowerCase().includes('not found') || content.headings.h1[0]?.toLowerCase().includes('error'));

  // Score
  let score = 100;
  if (hasNoindex) score -= 40;
  if (canonicalIssues.length > 0) score -= 15;
  if (thinContent) score -= 10;
  if (softFourOFourRisk) score -= 20;

  return {
    isIndexable: !hasNoindex,
    indexabilityIssues,
    redirectChainLength: 0, // Will be set by API
    redirectChain: undefined,
    hasRedirectLoop: false,
    hasPagination,
    paginationMethod,
    hasRelPrev: !!relPrev,
    hasRelNext: !!relNext,
    canonicalIssues,
    selfCanonical,
    softFourOFourRisk,
    thinContent,
    metaRobots,
    xRobotsTag,
    score: Math.max(0, score)
  };
}

// ============================================
// CONTENT QUALITY ANALYSIS
// ============================================

function analyzeContentQuality(doc: Document, content: any): any {
  // Content Freshness
  const publishDateMeta = doc.querySelector('meta[property="article:published_time"], meta[name="pubdate"], time[datetime][pubdate]');
  const modifiedDateMeta = doc.querySelector('meta[property="article:modified_time"], meta[name="last-modified"]');
  const publishDate = publishDateMeta?.getAttribute('content') || publishDateMeta?.getAttribute('datetime');
  const modifiedDate = modifiedDateMeta?.getAttribute('content');

  let contentAge: number | undefined;
  if (publishDate) {
    try {
      contentAge = Math.floor((Date.now() - new Date(publishDate).getTime()) / (1000 * 60 * 60 * 24));
    } catch { /* ignore */ }
  }

  // Content Structure
  const lists = doc.querySelectorAll('ul, ol');
  const tables = doc.querySelectorAll('table');
  const hasTableOfContents = !!doc.querySelector('[class*="toc"], [class*="table-of-contents"], #toc, nav[class*="content"]');
  const hasStructuredContent = lists.length > 2 || tables.length > 0 || hasTableOfContents;

  // Above the fold
  const hasHeroSection = !!doc.querySelector('[class*="hero"], [class*="banner"], header img, .jumbotron');
  const firstParagraph = doc.querySelector('main p, article p, .content p');
  const aboveFoldContent = !!(firstParagraph && firstParagraph.textContent && firstParagraph.textContent.length > 100);

  // Unique word ratio
  const words = content.keywordDensity?.map((k: any) => k.word) || [];
  const uniqueWordRatio = words.length > 0 ? words.length / content.wordCount : 0;

  // Boilerplate ratio estimation
  const mainContent = doc.querySelector('main, article, [role="main"], .content')?.textContent?.length || 0;
  const totalText = doc.body?.textContent?.length || 1;
  const boilerplateRatio = 1 - (mainContent / totalText);

  // Score
  let score = 100;
  if (content.wordCount < 300) score -= 20;
  if (content.wordCount < 100) score -= 20;
  if (!publishDate) score -= 5;
  if (contentAge && contentAge > 365) score -= 10;
  if (!hasStructuredContent) score -= 10;
  if (boilerplateRatio > 0.7) score -= 15;
  if (content.duplicateParagraphs > 2) score -= 10;

  return {
    hasPublishDate: !!publishDate,
    publishDate,
    hasModifiedDate: !!modifiedDate,
    modifiedDate,
    contentAge,
    isThinContent: content.wordCount < 300,
    wordCount: content.wordCount,
    uniqueWordRatio,
    aboveFoldContent,
    hasHeroSection,
    duplicateParagraphRatio: content.paragraphCount > 0 ? content.duplicateParagraphs / content.paragraphCount : 0,
    boilerplateRatio,
    hasTableOfContents,
    hasStructuredContent,
    listCount: lists.length,
    tableCount: tables.length,
    score: Math.max(0, score)
  };
}

// ============================================
// E-E-A-T SIGNALS ANALYSIS
// ============================================

function analyzeEEAT(doc: Document, trustSignals: any, security: any, schema: any): any {
  const issues: string[] = [];

  // Experience - First person narrative detection
  const bodyText = doc.body?.textContent?.toLowerCase() || '';
  const hasFirstPersonNarrative = /\b(i |i'|my |we |we'|our |myself|ourselves)\b/.test(bodyText);
  const hasOriginalContent = bodyText.length > 1000 && !bodyText.includes('lorem ipsum');

  // Expertise - Author information
  const authorElement = doc.querySelector('[rel="author"], .author, [class*="author"], [itemprop="author"]');
  const authorName = authorElement?.textContent?.trim();
  const hasAuthorBio = !!doc.querySelector('.author-bio, [class*="author-bio"], [class*="about-author"]');
  const hasCredentials = !!doc.querySelector('[class*="credential"], [class*="qualification"], .md, .phd, .expert');
  const hasExpertSchema = schema.types.some((t: string) => t.toLowerCase().includes('person') || t.toLowerCase().includes('author'));

  // Authoritativeness - Citations and references
  const citations = doc.querySelectorAll('cite, blockquote[cite], [class*="citation"], [class*="source"]');
  const externalLinks = doc.querySelectorAll('a[href^="http"]:not([href*="' + (new URL(doc.URL || 'http://example.com').hostname) + '"])');
  const hasAwards = !!doc.querySelector('[class*="award"], [class*="badge"], [class*="recognition"]');

  // Trustworthiness
  const hasSecureConnection = security.isHttps;
  const hasPrivacyPolicy = trustSignals.hasPrivacyPage;
  const hasContactInfo = trustSignals.hasContactPage || trustSignals.hasPhone || trustSignals.hasEmail;
  const hasPhysicalAddress = trustSignals.hasAddress;
  const hasAboutPage = trustSignals.hasAboutPage;
  const hasReviews = trustSignals.hasReviews || !!doc.querySelector('[class*="review"], [class*="testimonial"]');

  // Issues
  if (!hasAuthorBio) issues.push('No author bio/information');
  if (citations.length === 0) issues.push('No citations or references');
  if (!hasContactInfo) issues.push('No contact information');
  if (!hasPrivacyPolicy) issues.push('No privacy policy');
  if (!hasAboutPage) issues.push('No about page');

  // Score
  let score = 50; // Base score
  if (hasAuthorBio) score += 10;
  if (authorName) score += 5;
  if (hasCredentials) score += 10;
  if (citations.length > 0) score += 10;
  if (hasSecureConnection) score += 5;
  if (hasPrivacyPolicy) score += 5;
  if (hasContactInfo) score += 5;
  if (hasPhysicalAddress) score += 5;
  if (hasAboutPage) score += 5;
  if (hasReviews) score += 5;
  if (hasOriginalContent) score += 5;

  return {
    hasOriginalContent,
    hasFirstPersonNarrative,
    hasAuthorBio,
    authorName,
    hasCredentials,
    hasExpertSchema,
    hasCitations: citations.length > 0,
    citationCount: citations.length,
    hasExternalReferences: externalLinks.length > 0,
    hasAwards,
    hasSecureConnection,
    hasPrivacyPolicy,
    hasContactInfo,
    hasPhysicalAddress,
    hasAboutPage,
    hasReviews,
    score: Math.min(100, score),
    issues
  };
}

// ============================================
// DEFAULT SERVER RESPONSE (set by API)
// ============================================

function getDefaultServerResponse(): any {
  return {
    isHttp2: false,
    isHttp3: false,
    hasCompression: false,
    hasCacheControl: false,
    hasETag: false,
    score: 50
  };
}

// ============================================
// COLLECT PASSED
// ============================================

function collectPassed(data: any): string[] {
  const passed: string[] = [];
  const { technical, international, content, links, images, schema, social, accessibility, dom, performance, security, trustSignals, mobile } = data;

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

  // Mobile
  if (mobile && mobile.score >= 80) passed.push(`მობილური მეგობრულობა (${mobile.score}/100) ✓`);
  if (mobile && mobile.hasViewport && mobile.hasWidthDeviceWidth) passed.push('Viewport კონფიგურაცია ✓');
  if (mobile && mobile.hasMediaQueries) passed.push(`Media queries (${mobile.mediaQueryCount}) ✓`);
  if (mobile && (mobile.hasFlexbox || mobile.hasGrid)) passed.push('რესპონსიული layout (flexbox/grid) ✓');
  if (mobile && mobile.hasManifest) passed.push('Web App Manifest ✓');
  if (mobile && mobile.responsiveImagesCount > 0) passed.push(`რესპონსიული სურათები (${mobile.responsiveImagesCount}) ✓`);
  if (mobile && mobile.smallTapTargets === 0) passed.push('Tap targets ოპტიმალურია ✓');
  if (mobile && !mobile.hasUserScalable) passed.push('მასშტაბირება ნებადართულია ✓');

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
