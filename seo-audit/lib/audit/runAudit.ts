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

  const issues = collectIssues({ technical, international, content, links, images, schema, social, accessibility, dom: domData, performance, security, platform, mobile });
  const passed = collectPassed({ technical, international, content, links, images, schema, social, accessibility, dom: domData, performance, security, platform, trustSignals, mobile });
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
    technical, international, content, links, images, schema, social, accessibility, dom: domData, performance, security, platform, trustSignals, mobile, externalResources, issues, passed,
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

  // Get words - filter out very short tokens (supports Georgian, Cyrillic, Latin, German umlauts)
  const words = cleanText.split(/\s+/).filter((w) => {
    const lettersOnly = w.replace(/[^\u10A0-\u10FF\u0400-\u04FFa-zA-ZäöüÄÖÜß]/g, '');
    return lettersOnly.length >= 2;
  });
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
    // German Flesch formula (Amstad) - adjusted for longer German words
    // German words average ~2.5 syllables vs English ~1.5
    // Standard Amstad: 180 - ASL - (58.5 * ASW)
    // We use a slightly reduced coefficient for syllables to account for German morphology
    fleschScore = 180 - avgSentenceLength - (52 * avgSyllablesPerWord);
  } else if (lang === 'ka') {
    // Georgian adapted formula
    // Georgian is agglutinative with many suffixes, average ~3 syllables per word
    // Use a formula that doesn't penalize as heavily for syllable count
    fleschScore = 206.835 - (1.015 * avgSentenceLength) - (40 * avgSyllablesPerWord);
  } else if (lang === 'ru') {
    // Russian adapted formula
    // Russian averages ~2.5 syllables per word
    fleschScore = 206.835 - (1.3 * avgSentenceLength) - (50 * avgSyllablesPerWord);
  } else {
    // English Flesch-Kincaid formula (standard)
    // Most web content averages ~1.5 syllables/word and ~15 words/sentence
    // Standard formula: 206.835 - (1.015 * ASL) - (84.6 * ASW)
    // For typical web text (1.5 syl/word, 15 words/sent): 206.835 - 15.225 - 126.9 = 64.7 (Standard)
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
  let declaredLanguage: 'ka' | 'ru' | 'de' | 'en' | null = null;
  if (htmlLang) {
    const langCode = htmlLang.toLowerCase().split('-')[0];
    if (langCode === 'ka') declaredLanguage = 'ka';
    else if (langCode === 'ru' || langCode === 'uk' || langCode === 'be') declaredLanguage = 'ru'; // Ukrainian, Belarusian treated as Russian for readability
    else if (langCode === 'de') declaredLanguage = 'de';
    else if (langCode === 'en') declaredLanguage = 'en';
  }

  // Use declared language if available, otherwise use detected language
  const detectedLanguage = declaredLanguage || contentLanguage;

  // Detect H1/visible title language
  const visibleTitleText = headings.h1[0] || title;
  const titleLanguage = visibleTitleText.length > 10 ? detectLanguage(visibleTitleText) : null;

  // Check if title language matches content language
  const titleContentLangMismatch = titleLanguage && detectedLanguage && titleLanguage !== detectedLanguage;

  // Keyword extraction - include Georgian, Cyrillic, German umlauts
  const wordFreq: Record<string, number> = {};
  words.forEach((w) => {
    // Keep Georgian (U+10A0-U+10FF), Cyrillic (U+0400-U+04FF), Latin + German umlauts
    const word = w.toLowerCase().replace(/[^\u10A0-\u10FF\u0400-\u04FFa-z0-9äöüß]/g, '');
    if (word.length > 2 && !PATTERNS.STOP_WORDS.has(word)) wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  const keywordDensity = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count, percentage: Math.round((count / wordCount) * 10000) / 100 }));

  return { headings, wordCount, characterCount, sentenceCount: sentences.length, paragraphCount: paragraphs.length, readingTime, titleH1Duplicate, duplicateParagraphs, aiScore, aiPhrases, readability, keywordDensity, detectedLanguage, titleLanguage, titleContentLangMismatch };
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
          // Collect external URLs for 404 checking
          if (externalUrls.length < 20) {
            externalUrls.push({ href, text: text.substring(0, 50) });
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
      if (fullUrl && !href.includes('#') && internalUrls.length < 20) {
        internalUrls.push({ href: fullUrl, text: text.substring(0, 50) });
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
    internalUrls: internalUrls.slice(0, 15), // For redirect checking
    externalUrls: externalUrls.slice(0, 20), // For 404 checking
    redirectLinks: 0, redirectList: [] as { href: string; text: string; status: number; location: string }[],
    brokenExternalLinks: 0, brokenExternalList: [] as { href: string; text: string; status: number; error?: string }[]
  };
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

  // Check for broken/invalid image sources
  const brokenImages: { src: string; alt: string }[] = [];
  // Collect image URLs for size checking
  const imageUrls: { src: string; alt: string }[] = [];

  images.forEach((img) => {
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '(no alt)';
    // Check for empty, invalid, or placeholder sources
    if (!src || src === '#' || src === 'undefined' || src === 'null' ||
        src.startsWith('data:,') || src === 'about:blank' ||
        (src.startsWith('data:') && src.length < 50)) {
      brokenImages.push({ src: src || '(empty)', alt: alt.substring(0, 30) });
    } else if (src.startsWith('http') && imageUrls.length < 15) {
      // Collect external image URLs for size checking
      imageUrls.push({ src, alt: alt.substring(0, 30) });
    }
  });

  return {
    total: images.length, withoutAlt, withEmptyAlt, withoutDimensions, lazyLoaded, lazyAboveFold,
    clickableWithoutAlt, decorativeCount: withEmptyAlt, largeImages: images.length - srcsetCount,
    modernFormats, srcsetCount,
    brokenCount: brokenImages.length,
    brokenList: brokenImages.slice(0, 10),
    imageUrls: imageUrls.slice(0, 15) // For size checking
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
    issues.push('Viewport მეტა ტეგი არ არის - მობილურზე არასწორად გამოჩნდება');
    score -= 25;
  } else if (!hasWidthDeviceWidth) {
    issues.push('Viewport არ შეიცავს width=device-width');
    score -= 10;
  }
  if (hasUserScalable) {
    issues.push('user-scalable=no აფერხებს მასშტაბირებას - ხელმისაწვდომობის პრობლემა');
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
        tapTargetsList.push({ element: el.tagName.toLowerCase(), size: 'პატარა (კლასი)' });
      }
    }
  });

  if (smallTapTargets > 5) {
    issues.push(`${smallTapTargets} პატარა tap target - მინიმუმ 44x44px საჭიროა`);
    score -= Math.min(15, smallTapTargets);
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
    issues.push(`${smallTextElements} ელემენტს აქვს <12px ფონტი - წაკითხვა რთულია მობილურზე`);
    score -= 5;
  }

  // Media queries analysis
  const mediaQueryMatches = html.match(/@media[^{]+\{/g) || [];
  const hasMediaQueries = mediaQueryMatches.length > 0;
  const mediaQueryCount = mediaQueryMatches.length;

  // Flexbox and Grid
  const hasFlexbox = htmlLower.includes('display: flex') || htmlLower.includes('display:flex');
  const hasGrid = htmlLower.includes('display: grid') || htmlLower.includes('display:grid');

  if (!hasMediaQueries && !hasFlexbox && !hasGrid) {
    issues.push('რესპონსიული დიზაინი არ არის აღმოჩენილი (არც media queries, არც flexbox/grid)');
    score -= 15;
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
    issues.push('ელემენტები ფიქსირებული სიგანით >500px - ჰორიზონტალური scroll მობილურზე');
    score -= 10;
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
    issues.push(`მხოლოდ ${responsiveImagesCount}/${totalImages} სურათს აქვს srcset - მობილურზე დიდ სურათებს ჩატვირთავს`);
    score -= 5;
  }

  // Bonus points
  if (hasManifest) score += 5;
  if (hasThemeColor) score += 2;
  if (usesRelativeFontSizes) score += 3;

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

// Severity phrases in Georgian
const SEVERITY_PHRASES = {
  critical: 'კრიტიკული! დაუყოვნებლივ გამოსწორება საჭირო.',
  high: 'მაღალი პრიორიტეტი! SEO-ზე მნიშვნელოვნად მოქმედებს.',
  medium: 'საშუალო პრიორიტეტი. რეკომენდებულია გამოსწორება.',
  low: 'დაბალი პრიორიტეტი. სასურველია გამოსწორება.'
};

function collectIssues(data: any): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const { technical, international, content, links, images, schema, social, accessibility, dom, performance, security, platform, mobile } = data;

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

  // Content language vs declared lang attribute mismatch
  if (technical.language && content.detectedLanguage) {
    const declaredLang = technical.language.toLowerCase().split('-')[0]; // e.g., "en-US" -> "en"
    const langMap: Record<string, string[]> = {
      'ka': ['ka'], 'ru': ['ru'], 'de': ['de'], 'en': ['en']
    };
    const expectedLangs = langMap[content.detectedLanguage] || ['en'];
    if (!expectedLangs.includes(declaredLang)) {
      const langNames: Record<string, string> = { 'ka': 'ქართული', 'ru': 'რუსული', 'de': 'გერმანული', 'en': 'ინგლისური' };
      issues.push({
        id: 'lang-content-mismatch',
        severity: 'high',
        category: 'საერთაშორისო',
        issue: `Content language mismatch: declared "${technical.language}" but content is ${content.detectedLanguage}`,
        issueGe: `კონტენტის ენა არ ემთხვევა: დეკლარირებულია "${technical.language}", მაგრამ კონტენტი არის ${langNames[content.detectedLanguage] || content.detectedLanguage}`,
        location: '<html lang>',
        fix: `Change lang="${technical.language}" to lang="${content.detectedLanguage}"`,
        fixGe: `შეცვალეთ lang="${technical.language}" -> lang="${content.detectedLanguage}"`,
        details: `${SEVERITY_PHRASES.high} გვერდის კონტენტი ${langNames[content.detectedLanguage] || content.detectedLanguage} ენაზეა, მაგრამ HTML lang ატრიბუტი მიუთითებს "${technical.language}"-ზე. ეს აბნევს საძიებო სისტემებს და სკრინრიდერებს.`
      });
    }
  }

  // Title vs Content language mismatch (German title but English content, etc.)
  if (content.titleContentLangMismatch && content.titleLanguage && content.detectedLanguage) {
    const langNames: Record<string, string> = { 'ka': 'ქართული', 'ru': 'რუსული', 'de': 'გერმანული', 'en': 'ინგლისური' };
    issues.push({
      id: 'title-content-lang-mismatch',
      severity: 'high',
      category: 'კონტენტი',
      issue: `Title language (${content.titleLanguage}) differs from content language (${content.detectedLanguage})`,
      issueGe: `სათაურის ენა (${langNames[content.titleLanguage] || content.titleLanguage}) განსხვავდება კონტენტის ენისგან (${langNames[content.detectedLanguage] || content.detectedLanguage})`,
      location: '<title>',
      fix: 'Use same language for title and content',
      fixGe: 'გამოიყენეთ ერთი ენა სათაურისა და კონტენტისთვის',
      details: `${SEVERITY_PHRASES.high} სათაური ${langNames[content.titleLanguage] || content.titleLanguage} ენაზეა, მაგრამ გვერდის კონტენტი ${langNames[content.detectedLanguage] || content.detectedLanguage} ენაზეა. ეს აბნევს მომხმარებლებს და საძიებო სისტემებს.`
    });
  }

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

    // Duplicate hreflang languages
    if (international.duplicateHreflangs && international.duplicateHreflangs.length > 0) {
      issues.push({ id: 'duplicate-hreflangs', severity: 'high', category: 'საერთაშორისო', issue: `Duplicate hreflang languages: ${international.duplicateHreflangs.join(', ')}`, issueGe: `დუბლირებული hreflang ენები: ${international.duplicateHreflangs.join(', ')}`, location: '<head>', fix: 'Remove duplicate hreflang entries - each language should appear only once', fixGe: 'წაშალეთ დუბლირებული hreflang - თითოეული ენა მხოლოდ ერთხელ უნდა იყოს', details: `${SEVERITY_PHRASES.high} ერთი და იგივე ენის hreflang რამდენჯერმე მითითებულია. ეს აბნევს Google-ს.` });
    }

    // Hreflangs pointing to non-canonical URLs
    if (international.nonCanonicalHreflangs && international.nonCanonicalHreflangs.length > 0) {
      issues.push({ id: 'hreflang-non-canonical', severity: 'high', category: 'საერთაშორისო', issue: `Hreflang URLs may not be canonical`, issueGe: `Hreflang URL-ები შეიძლება არაკანონიკურია`, location: '<head>', fix: 'Hreflang URLs should be clean canonical URLs without query params or fragments', fixGe: 'Hreflang URL-ები უნდა იყოს სუფთა, query params-ის და fragment-ის გარეშე', details: `${SEVERITY_PHRASES.high} პრობლემები: ${international.nonCanonicalHreflangs.slice(0, 5).join('; ')}` });
    }

    international.issues.forEach((issue: string, i: number) => issues.push({ id: `hreflang-${i}`, severity: 'high', category: 'საერთაშორისო', issue, issueGe: issue, location: '<head>', fix: 'Fix hreflang configuration', fixGe: 'გაასწორეთ hreflang', details: `${SEVERITY_PHRASES.high} ${issue}` }));
  }

  // Images
  if (images.withoutAlt > 0) issues.push({ id: 'img-no-alt', severity: images.withoutAlt > 5 ? 'high' : 'medium', category: 'ხელმისაწვდომობა', issue: `${images.withoutAlt} image(s) missing alt text`, issueGe: `${images.withoutAlt} სურათს არ აქვს alt ტექსტი`, location: '<img>', fix: 'Add descriptive alt text to all images', fixGe: 'დაამატეთ აღწერითი alt ტექსტი', details: `${images.withoutAlt > 5 ? SEVERITY_PHRASES.high : SEVERITY_PHRASES.medium} ${images.withoutAlt} სურათს აკლია alt ატრიბუტი. Alt ტექსტი აუცილებელია ხელმისაწვდომობისთვის და სურათების SEO-სთვის.` });
  if (images.withoutDimensions > 0) issues.push({ id: 'img-no-dim', severity: 'medium', category: 'სიჩქარე', issue: `${images.withoutDimensions} image(s) without dimensions`, issueGe: `${images.withoutDimensions} სურათს არ აქვს ზომები`, location: '<img>', fix: 'Add width and height attributes', fixGe: 'დაამატეთ width და height ატრიბუტები', details: `${SEVERITY_PHRASES.medium} სურათების ზომების მითითება ხელს უშლის CLS (Cumulative Layout Shift) პრობლემას და აუმჯობესებს Core Web Vitals.` });
  if (images.brokenCount > 0) issues.push({ id: 'broken-images', severity: 'high', category: 'სურათები', issue: `${images.brokenCount} broken/invalid image(s) found`, issueGe: `${images.brokenCount} გატეხილი/არასწორი სურათი`, location: '<img src="">', fix: 'Fix or remove broken image sources', fixGe: 'გაასწორეთ ან წაშალეთ გატეხილი სურათები', details: `${SEVERITY_PHRASES.high} ნაპოვნი გატეხილი სურათები: ${images.brokenList.slice(0, 5).map((img: any) => `"${img.alt}" (src: ${img.src})`).join('; ')}. ცარიელი ან არასწორი src აუარესებს UX-ს.` });
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

  // Mobile Friendliness
  if (mobile && mobile.score < 50) issues.push({ id: 'mobile-poor', severity: 'critical', category: 'მობილური', issue: `Poor mobile friendliness score (${mobile.score}/100)`, issueGe: `დაბალი მობილური მეგობრულობა (${mobile.score}/100)`, location: 'გვერდი', fix: 'Fix mobile issues: viewport, tap targets, responsive design', fixGe: 'გაასწორეთ მობილური პრობლემები', details: `${SEVERITY_PHRASES.critical} მობილური ტრაფიკი 60%+-ია. დაბალი მობილური ქულა პირდაპირ აზარალებს რანჟირებას. პრობლემები: ${mobile.issues.slice(0, 3).join('; ')}` });
  else if (mobile && mobile.score < 70) issues.push({ id: 'mobile-needs-work', severity: 'high', category: 'მობილური', issue: `Mobile friendliness needs improvement (${mobile.score}/100)`, issueGe: `მობილურზე გაუმჯობესება საჭიროა (${mobile.score}/100)`, location: 'გვერდი', fix: 'Improve responsive design and tap targets', fixGe: 'გააუმჯობესეთ რესპონსიული დიზაინი', details: `${SEVERITY_PHRASES.high} პრობლემები: ${mobile.issues.slice(0, 3).join('; ')}` });

  if (mobile && mobile.smallTapTargets > 10) issues.push({ id: 'small-tap-targets', severity: 'high', category: 'მობილური', issue: `${mobile.smallTapTargets} small tap targets detected`, issueGe: `${mobile.smallTapTargets} პატარა tap target აღმოჩენილია`, location: 'ბმულები/ღილაკები', fix: 'Ensure tap targets are at least 48x48px with 8px spacing', fixGe: 'გაზარდეთ tap targets მინიმუმ 48x48px-მდე', details: `${SEVERITY_PHRASES.high} მომხმარებლები ვერ ახერხებენ პატარა ელემენტებზე დაჭერას მობილურზე. Google-ის რეკომენდაცია: მინიმუმ 48x48px.` });

  if (mobile && mobile.horizontalScrollRisk) issues.push({ id: 'horizontal-scroll', severity: 'high', category: 'მობილური', issue: 'Page may require horizontal scrolling on mobile', issueGe: 'გვერდს შეიძლება სჭირდეს ჰორიზონტალური scroll მობილურზე', location: 'ფიქსირებული სიგანის ელემენტები', fix: 'Use max-width: 100% and responsive units', fixGe: 'გამოიყენეთ max-width: 100% და რესპონსიული ერთეულები', details: `${SEVERITY_PHRASES.high} ფიქსირებული სიგანის ელემენტები იწვევს ჰორიზონტალურ scroll-ს. გამოიყენეთ % ან vw ერთეულები.` });

  if (mobile && !mobile.hasMediaQueries && !mobile.hasFlexbox && !mobile.hasGrid) issues.push({ id: 'no-responsive', severity: 'high', category: 'მობილური', issue: 'No responsive design detected', issueGe: 'რესპონსიული დიზაინი არ არის აღმოჩენილი', location: 'CSS', fix: 'Add media queries or use flexbox/grid', fixGe: 'დაამატეთ media queries ან flexbox/grid', details: `${SEVERITY_PHRASES.high} რესპონსიული დიზაინი აუცილებელია მობილური მოწყობილობებისთვის. გამოიყენეთ @media queries, flexbox ან CSS grid.` });

  if (mobile && mobile.hasUserScalable) issues.push({ id: 'no-zoom', severity: 'medium', category: 'ხელმისაწვდომობა', issue: 'Zooming is disabled (user-scalable=no)', issueGe: 'მასშტაბირება გამორთულია (user-scalable=no)', location: '<meta name="viewport">', fix: 'Remove user-scalable=no from viewport', fixGe: 'წაშალეთ user-scalable=no viewport-იდან', details: `${SEVERITY_PHRASES.medium} მასშტაბირების გამორთვა აფერხებს მხედველობის პრობლემის მქონე მომხმარებლებს. WCAG მოითხოვს მასშტაბირების შესაძლებლობას.` });

  return issues;
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
