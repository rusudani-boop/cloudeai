import React, { useState, useCallback } from 'react';
import { 
  AlertCircle, CheckCircle, XCircle, Download, FileText, 
  Globe, Zap, Search, Shield, Image, Link2, Code, 
  BarChart3, Brain, Loader2, ChevronDown, ChevronUp,
  ExternalLink, Copy, Check, AlertTriangle, Info
} from 'lucide-react';

// Backend API configuration
// Set this to your backend URL when deployed, or null to use CORS proxies only
// Examples:
//   'http://localhost:3001'           - Local development
//   'https://api.yourdomain.com'      - Your hosted backend
//   null                              - Use CORS proxies only (default)
const BACKEND_API_URL = null;

// CORS Proxies - fallback when backend is unavailable
const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://proxy.cors.sh/${url}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

// Anti-bot detection patterns
const BLOCKED_PATTERNS = [
  'cf-browser-verification',
  'Attention Required',
  '__cf_chl',
  '_cf_chl_opt',
  'Checking your browser',
  'Just a moment...',
  'Enable JavaScript and cookies',
  'cf-challenge',
  'challenge-platform',
  'ray-id',
  'Cloudflare Ray ID',
  'Please Wait... | Cloudflare',
  'DDoS protection by',
  'Incapsula incident',
  'Access denied',
  'Sorry, you have been blocked'
];

const SEOAuditToolPro = () => {
  const [url, setUrl] = useState('');
  const [htmlSource, setHtmlSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [inputMode, setInputMode] = useState('url');
  const [expandedSections, setExpandedSections] = useState({});
  const [copied, setCopied] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Handle file drop for HTML files
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      if (file.type === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setHtmlSource(event.target.result);
          setInputMode('html');
          setResults(null);
          setAiAnalysis(null);
        };
        reader.readAsText(file);
      } else {
        setError('Please drop an HTML file (.html or .htm)');
      }
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Fetch using backend API (Playwright/Cloudflare Worker)
  const fetchWithBackend = async (targetUrl) => {
    if (!BACKEND_API_URL) {
      throw new Error('NO_BACKEND');
    }
    
    setFetchStatus('Fetching via backend server...');
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 35000);
      
      const response = await fetch(`${BACKEND_API_URL}/api/fetch-multi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Backend fetch failed');
      }
      
      return {
        html: data.html.html,
        robotsTxt: data.robots?.success ? data.robots.content : null,
        sitemapAccessible: data.sitemap?.accessible ?? null,
        finalUrl: data.html.finalUrl,
        xRobotsTag: data.html.headers?.xRobotsTag
      };
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Backend request timed out');
      }
      throw error;
    }
  };

  // Fetch URL with CORS proxy - parallel approach using Promise.any
  const fetchWithProxy = async (targetUrl) => {
    // If backend is configured, try it first
    if (BACKEND_API_URL) {
      setFetchStatus('Fetching via backend server...');
      try {
        const response = await fetch(`${BACKEND_API_URL}/api/fetch-html`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl, timeout: 30000 })
        });
        
        const data = await response.json();
        
        if (data.success && data.html) {
          setFetchStatus('');
          return data.html;
        }
        
        // Backend failed, fall through to CORS proxies
        console.log('Backend fetch failed, trying CORS proxies...');
      } catch (e) {
        console.log('Backend unavailable, trying CORS proxies...');
      }
    }
    
    // Fallback to CORS proxies
    setFetchStatus('Fetching via CORS proxies...');
    
    // Helper to check if HTML is blocked
    const isBlocked = (html) => {
      return BLOCKED_PATTERNS.some(pattern => html.includes(pattern));
    };
    
    // Helper to validate HTML response
    const isValidHtml = (html) => {
      return html && 
             html.length > 500 && 
             html.includes('<') && 
             (html.includes('<html') || html.includes('<head') || html.includes('<body')) &&
             !isBlocked(html);
    };
    
    // Create fetch promise for each proxy
    const createProxyFetch = (proxyFn, index) => {
      return new Promise(async (resolve, reject) => {
        try {
          const proxyUrl = proxyFn(targetUrl);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          
          const response = await fetch(proxyUrl, {
            signal: controller.signal,
            headers: { 
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          clearTimeout(timeout);
          
          if (!response.ok) {
            reject(new Error(`Proxy ${index + 1} returned ${response.status}`));
            return;
          }
          
          const html = await response.text();
          
          if (isValidHtml(html)) {
            resolve({ html, proxyIndex: index });
          } else if (isBlocked(html)) {
            reject(new Error(`Proxy ${index + 1}: Site has anti-bot protection`));
          } else {
            reject(new Error(`Proxy ${index + 1}: Invalid or empty response`));
          }
        } catch (e) {
          reject(new Error(`Proxy ${index + 1}: ${e.message}`));
        }
      });
    };
    
    // Try all proxies in parallel
    const proxyPromises = CORS_PROXIES.map((proxyFn, i) => createProxyFetch(proxyFn, i));
    
    try {
      // Promise.any resolves with the first successful result
      const result = await Promise.any(proxyPromises);
      setFetchStatus('');
      return result.html;
    } catch (aggregateError) {
      // All proxies failed - check if it's due to anti-bot
      const errors = aggregateError.errors || [];
      const hasAntiBot = errors.some(e => e.message.includes('anti-bot'));
      
      if (hasAntiBot) {
        throw new Error('ANTIBOT');
      }
      throw new Error('BLOCKED');
    }
  };
  
  // Fetch robots.txt (uses backend if available, otherwise simple proxy)
  const fetchRobotsTxt = async (baseUrl) => {
    // Try backend first
    if (BACKEND_API_URL) {
      try {
        const response = await fetch(`${BACKEND_API_URL}/api/fetch-robots?url=${encodeURIComponent(baseUrl)}`);
        const data = await response.json();
        if (data.success && data.content) {
          return data.content;
        }
      } catch (e) {
        // Fall through to proxy method
      }
    }
    
    // Fallback to CORS proxy
    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).href;
      const proxyUrl = CORS_PROXIES[0](robotsUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeout);
      
      if (response.ok) {
        const text = await response.text();
        if (text && text.length > 10 && !text.includes('<html')) {
          return text;
        }
      }
    } catch (e) {
      // Silently fail
    }
    return null;
  };
  
  // Check sitemap existence (uses backend if available)
  const checkSitemap = async (baseUrl) => {
    // Try backend first
    if (BACKEND_API_URL) {
      try {
        const response = await fetch(`${BACKEND_API_URL}/api/check-sitemap?url=${encodeURIComponent(baseUrl)}`);
        const data = await response.json();
        return data.exists || false;
      } catch (e) {
        // Fall through to proxy method
      }
    }
    
    // Fallback to CORS proxy HEAD request
    try {
      const sitemapUrl = new URL('/sitemap.xml', baseUrl).href;
      const proxyUrl = CORS_PROXIES[0](sitemapUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(proxyUrl, { 
        signal: controller.signal,
        method: 'HEAD'
      });
      clearTimeout(timeout);
      
      return response.ok;
    } catch (e) {
      return null; // Unknown
    }
  };

  // Main HTML analysis function
  const analyzeHTML = (html, sourceUrl) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const checksPerformed = [];
    const detailedErrors = [];
    const warnings = [];
    const passed = [];
    
    const images = Array.from(doc.querySelectorAll('img'));
    const links = Array.from(doc.querySelectorAll('a[href]'));
    const scripts = Array.from(doc.querySelectorAll('script'));
    const stylesheets = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    const bodyText = doc.body?.textContent?.trim() || '';
    const bodyHtml = doc.body?.innerHTML || '';

    // ==========================================
    // 1. TITLE TAG ANALYSIS
    // ==========================================
    checksPerformed.push('Title tag analysis');
    const title = doc.querySelector('title')?.textContent?.trim() || '';
    
    if (!title) {
      detailedErrors.push({
        severity: 'critical',
        category: 'Technical',
        issue: 'Missing title tag',
        location: '<head>',
        fix: 'Add <title>Your Page Title (30-60 chars)</title>',
        impact: 'Title is the #1 ranking factor for on-page SEO'
      });
    } else {
      if (title.length < 30) {
        detailedErrors.push({
          severity: 'high',
          category: 'Technical',
          issue: `Title too short (${title.length} chars)`,
          location: '<head>',
          fix: 'Expand title to 30-60 characters for optimal CTR',
          current: title,
          impact: 'Short titles may not fully describe page content'
        });
      } else if (title.length > 60) {
        warnings.push({
          severity: 'medium',
          category: 'Technical',
          issue: `Title may be truncated (${title.length} chars)`,
          location: '<head>',
          fix: 'Keep title under 60 characters to prevent truncation in SERPs',
          current: title.substring(0, 60) + '...',
          impact: 'Google typically displays 50-60 characters'
        });
      } else {
        passed.push(`Title tag optimal (${title.length} chars)`);
      }
    }

    // ==========================================
    // 2. META DESCRIPTION ANALYSIS
    // ==========================================
    checksPerformed.push('Meta description analysis');
    const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
    
    if (!metaDesc) {
      detailedErrors.push({
        severity: 'high',
        category: 'Technical',
        issue: 'Missing meta description',
        location: '<head>',
        fix: 'Add <meta name="description" content="Your description (120-160 chars)">',
        impact: 'Meta description affects CTR in search results'
      });
    } else {
      if (metaDesc.length < 120) {
        warnings.push({
          severity: 'medium',
          category: 'Technical',
          issue: `Meta description too short (${metaDesc.length} chars)`,
          location: '<head>',
          fix: 'Expand to 120-160 characters for optimal display',
          current: metaDesc,
          impact: 'Short descriptions may not fully utilize SERP space'
        });
      } else if (metaDesc.length > 160) {
        warnings.push({
          severity: 'low',
          category: 'Technical',
          issue: `Meta description may be truncated (${metaDesc.length} chars)`,
          location: '<head>',
          fix: 'Keep under 160 characters',
          current: metaDesc.substring(0, 160) + '...',
          impact: 'Google typically displays 150-160 characters'
        });
      } else {
        passed.push(`Meta description optimal (${metaDesc.length} chars)`);
      }
    }

    // ==========================================
    // 3. CANONICAL TAG VALIDATION
    // ==========================================
    checksPerformed.push('Canonical tag validation');
    const canonicals = Array.from(doc.querySelectorAll('link[rel="canonical"]'));
    const canonicalHref = canonicals[0]?.getAttribute('href') || '';
    
    if (canonicals.length === 0) {
      warnings.push({
        severity: 'medium',
        category: 'Technical',
        issue: 'Missing canonical tag',
        location: '<head>',
        fix: `Add <link rel="canonical" href="${sourceUrl}">`,
        impact: 'Canonical tags prevent duplicate content issues'
      });
    } else if (canonicals.length > 1) {
      detailedErrors.push({
        severity: 'critical',
        category: 'Technical',
        issue: `Multiple canonical tags found (${canonicals.length})`,
        location: '<head>',
        fix: 'Keep only ONE canonical tag per page',
        impact: 'Multiple canonicals confuse search engines'
      });
    } else {
      // Validate canonical URL
      if (canonicalHref && sourceUrl && !canonicalHref.includes(new URL(sourceUrl).hostname)) {
        warnings.push({
          severity: 'high',
          category: 'Technical',
          issue: 'Canonical points to different domain',
          location: '<head>',
          fix: 'Verify this is intentional (cross-domain canonical)',
          current: canonicalHref,
          impact: 'May transfer ranking signals to another domain'
        });
      } else {
        passed.push('Canonical tag present');
      }
    }

    // ==========================================
    // 4. VIEWPORT META TAG
    // ==========================================
    checksPerformed.push('Viewport meta tag check');
    const viewport = doc.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
    
    if (!viewport) {
      detailedErrors.push({
        severity: 'critical',
        category: 'Mobile',
        issue: 'Missing viewport meta tag',
        location: '<head>',
        fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
        impact: 'Page will not be mobile-friendly (Mobile-First Indexing)'
      });
    } else if (!viewport.includes('width=device-width')) {
      warnings.push({
        severity: 'high',
        category: 'Mobile',
        issue: 'Viewport may not be mobile-optimized',
        location: '<head>',
        fix: 'Use width=device-width for responsive design',
        current: viewport,
        impact: 'May cause mobile usability issues'
      });
    } else {
      passed.push('Viewport configured correctly');
    }

    // ==========================================
    // 5. CHARSET & LANGUAGE
    // ==========================================
    checksPerformed.push('Charset declaration check');
    const charset = doc.querySelector('meta[charset]')?.getAttribute('charset') || 
                    doc.querySelector('meta[http-equiv="Content-Type"]')?.getAttribute('content') || '';
    
    if (!charset) {
      warnings.push({
        severity: 'medium',
        category: 'Technical',
        issue: 'Missing charset declaration',
        location: '<head>',
        fix: 'Add <meta charset="UTF-8"> as first element in <head>',
        impact: 'May cause character encoding issues'
      });
    } else {
      passed.push('Charset declared');
    }

    checksPerformed.push('HTML lang attribute check');
    const htmlLang = doc.documentElement?.getAttribute('lang') || '';
    
    if (!htmlLang) {
      detailedErrors.push({
        severity: 'high',
        category: 'Accessibility',
        issue: 'Missing lang attribute on <html>',
        location: '<html>',
        fix: 'Add <html lang="en"> (use appropriate language code)',
        impact: 'Screen readers need this for proper pronunciation'
      });
    } else {
      passed.push(`Language declared: ${htmlLang}`);
    }

    // ==========================================
    // 6. ROBOTS META TAG
    // ==========================================
    checksPerformed.push('Robots meta tag analysis');
    const robotsMeta = doc.querySelector('meta[name="robots"]')?.getAttribute('content')?.toLowerCase() || '';
    const googlebotMeta = doc.querySelector('meta[name="googlebot"]')?.getAttribute('content')?.toLowerCase() || '';
    
    if (robotsMeta.includes('noindex') || googlebotMeta.includes('noindex')) {
      detailedErrors.push({
        severity: 'critical',
        category: 'Technical',
        issue: 'Page blocked from indexing (noindex)',
        location: '<head>',
        fix: 'Remove noindex if page should appear in search results',
        current: robotsMeta || googlebotMeta,
        impact: 'Page will NOT appear in Google search results'
      });
    }
    
    if (robotsMeta.includes('nofollow')) {
      warnings.push({
        severity: 'medium',
        category: 'Technical',
        issue: 'Links on page not followed (nofollow)',
        location: '<head>',
        fix: 'Remove nofollow if you want links to pass PageRank',
        impact: 'Internal links will not pass authority'
      });
    }

    // ==========================================
    // 7. HEADING STRUCTURE
    // ==========================================
    checksPerformed.push('Heading hierarchy analysis');
    const h1Elements = Array.from(doc.querySelectorAll('h1'));
    const h2Elements = Array.from(doc.querySelectorAll('h2'));
    const h3Elements = Array.from(doc.querySelectorAll('h3'));
    const h4Elements = Array.from(doc.querySelectorAll('h4'));
    
    const headings = {
      h1: h1Elements.map(h => h.textContent.trim()),
      h2: h2Elements.map(h => h.textContent.trim()),
      h3: h3Elements.map(h => h.textContent.trim()),
      h4: h4Elements.map(h => h.textContent.trim())
    };
    
    if (headings.h1.length === 0) {
      detailedErrors.push({
        severity: 'high',
        category: 'Content',
        issue: 'No H1 heading found',
        location: '<body>',
        fix: 'Add one <h1> tag containing the main topic/keyword',
        impact: 'H1 is crucial for SEO and accessibility'
      });
    } else if (headings.h1.length > 1) {
      warnings.push({
        severity: 'low',
        category: 'Content',
        issue: `Multiple H1 headings found (${headings.h1.length})`,
        location: '<body>',
        fix: 'Consider using one primary H1 for clearer topic focus (acceptable in HTML5)',
        details: headings.h1.join(' | '),
        impact: 'Generally fine in HTML5, but one H1 helps clarity'
      });
    } else {
      passed.push('Single H1 present');
    }

    // Check H1 vs Title duplication
    checksPerformed.push('Title vs H1 comparison');
    if (title && headings.h1[0]) {
      const titleLower = title.toLowerCase().trim();
      const h1Lower = headings.h1[0].toLowerCase().trim();
      
      if (titleLower === h1Lower) {
        warnings.push({
          severity: 'low',
          category: 'Content',
          issue: 'Title and H1 are identical',
          location: '<head> / <body>',
          fix: 'Consider making H1 slightly different to target more keywords',
          impact: 'Missed opportunity to target keyword variations'
        });
      }
    }

    // Check heading hierarchy (no skipped levels)
    checksPerformed.push('Heading hierarchy order');
    if (headings.h3.length > 0 && headings.h2.length === 0) {
      warnings.push({
        severity: 'medium',
        category: 'Content',
        issue: 'H3 used without H2 (skipped heading level)',
        location: '<body>',
        fix: 'Maintain proper hierarchy: H1 → H2 → H3',
        impact: 'Affects accessibility and content structure'
      });
    }

    // ==========================================
    // 8. HREFLANG ANALYSIS
    // ==========================================
    checksPerformed.push('Hreflang tags validation');
    const hreflangs = Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]')).map(link => ({
      hreflang: link.getAttribute('hreflang'),
      href: link.getAttribute('href')
    }));
    
    const hreflangIssues = [];
    
    if (hreflangs.length > 0) {
      // Check for x-default
      const hasXDefault = hreflangs.some(h => h.hreflang === 'x-default');
      if (!hasXDefault) {
        hreflangIssues.push('Missing x-default hreflang');
        warnings.push({
          severity: 'medium',
          category: 'International',
          issue: 'Missing x-default hreflang',
          location: '<head>',
          fix: 'Add <link rel="alternate" hreflang="x-default" href="...">',
          impact: 'Helps Google select the right page for unspecified regions'
        });
      }
      
      // Check self-referencing
      const currentUrlNormalized = sourceUrl?.toLowerCase().replace(/\/$/, '');
      const hasSelfRef = hreflangs.some(h => 
        h.href?.toLowerCase().replace(/\/$/, '') === currentUrlNormalized
      );
      if (!hasSelfRef && sourceUrl) {
        hreflangIssues.push('Missing self-referencing hreflang');
        warnings.push({
          severity: 'high',
          category: 'International',
          issue: 'Page does not reference itself in hreflang',
          location: '<head>',
          fix: 'Add hreflang pointing to the current page URL',
          impact: 'Required for proper hreflang implementation'
        });
      }
      
      // Validate each hreflang
      hreflangs.forEach((h, i) => {
        // Check for absolute URLs
        if (h.href && !h.href.startsWith('http')) {
          hreflangIssues.push(`Relative URL in hreflang #${i + 1}`);
          detailedErrors.push({
            severity: 'high',
            category: 'International',
            issue: 'Hreflang must use absolute URL',
            location: `<head> hreflang #${i + 1}`,
            fix: 'Use full URL: https://example.com/page',
            current: h.href,
            impact: 'Google may ignore invalid hreflang tags'
          });
        }
        
        // Validate language-region format (FIXED BUG)
        if (h.hreflang && h.hreflang !== 'x-default' && h.hreflang.includes('-')) {
          const parts = h.hreflang.split('-');
          if (parts.length === 2) {
            const regionCode = parts[1];
            // Check if region code is uppercase in the ORIGINAL (not lowercased)
            if (regionCode !== regionCode.toUpperCase()) {
              hreflangIssues.push(`Invalid format: ${h.hreflang}`);
              detailedErrors.push({
                severity: 'high',
                category: 'International',
                issue: `Hreflang region code should be uppercase: ${h.hreflang}`,
                location: `<head> hreflang #${i + 1}`,
                fix: `Change to ${parts[0].toLowerCase()}-${regionCode.toUpperCase()}`,
                impact: 'Invalid format may be ignored by Google'
              });
            }
          }
        }
      });
      
      if (hreflangIssues.length === 0) {
        passed.push(`Hreflang tags valid (${hreflangs.length} languages)`);
      }
    }

    // ==========================================
    // 9. SCHEMA.ORG STRUCTURED DATA
    // ==========================================
    checksPerformed.push('Schema.org structured data validation');
    const schemaScripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
    const schemas = [];
    
    schemaScripts.forEach((script, index) => {
      try {
        const rawContent = script.textContent;
        const data = JSON.parse(rawContent);
        const items = Array.isArray(data) ? data : [data];
        
        items.forEach((item, itemIndex) => {
          const schemaInfo = {
            index: `${index + 1}${items.length > 1 ? `.${itemIndex + 1}` : ''}`,
            type: item['@type'] || 'Unknown',
            valid: true,
            data: item,
            issues: []
          };
          
          // Check @context
          if (!item['@context']) {
            schemaInfo.issues.push('Missing @context');
            detailedErrors.push({
              severity: 'high',
              category: 'Schema',
              issue: 'Missing @context in schema',
              location: `Schema #${schemaInfo.index}`,
              fix: 'Add "@context": "https://schema.org"',
              impact: 'Schema may not be recognized'
            });
          }
          
          // Validate specific schema types
          const type = item['@type'];
          
          if (type === 'Product') {
            const missing = [];
            if (!item.name) missing.push('name');
            if (!item.image) missing.push('image');
            if (!item.description) missing.push('description');
            if (!item.offers && !item.review && !item.aggregateRating) {
              missing.push('offers/review/aggregateRating (need at least one)');
            }
            if (missing.length > 0) {
              schemaInfo.issues.push(`Missing: ${missing.join(', ')}`);
              detailedErrors.push({
                severity: 'high',
                category: 'Schema',
                issue: `Product schema incomplete`,
                location: `Schema #${schemaInfo.index}`,
                fix: `Add required fields: ${missing.join(', ')}`,
                impact: 'May not qualify for rich results'
              });
            }
          }
          
          if (type === 'Article' || type === 'BlogPosting' || type === 'NewsArticle') {
            const missing = [];
            if (!item.headline) missing.push('headline');
            if (!item.datePublished) missing.push('datePublished');
            if (!item.author) missing.push('author');
            if (!item.image) missing.push('image');
            if (type === 'NewsArticle' && !item.dateModified) missing.push('dateModified');
            if (missing.length > 0) {
              schemaInfo.issues.push(`Missing: ${missing.join(', ')}`);
              detailedErrors.push({
                severity: 'high',
                category: 'Schema',
                issue: `${type} schema incomplete`,
                location: `Schema #${schemaInfo.index}`,
                fix: `Add required fields: ${missing.join(', ')}`,
                impact: 'May not qualify for Article rich results'
              });
            }
            
            // Check author structure
            if (item.author && typeof item.author === 'object') {
              if (!item.author.name) {
                warnings.push({
                  severity: 'medium',
                  category: 'Schema',
                  issue: 'Article author missing name property',
                  location: `Schema #${schemaInfo.index}`,
                  fix: 'Add "name" to author object',
                  impact: 'Author name helps with E-E-A-T signals'
                });
              }
            }
          }
          
          if (type === 'Organization') {
            const missing = [];
            if (!item.name) missing.push('name');
            if (!item.url) missing.push('url');
            if (!item.logo) missing.push('logo');
            if (missing.length > 0) {
              schemaInfo.issues.push(`Missing: ${missing.join(', ')}`);
              warnings.push({
                severity: 'medium',
                category: 'Schema',
                issue: `Organization schema incomplete`,
                location: `Schema #${schemaInfo.index}`,
                fix: `Add recommended fields: ${missing.join(', ')}`,
                impact: 'Complete Organization schema improves brand appearance'
              });
            }
          }
          
          if (type === 'FAQPage') {
            if (!item.mainEntity || !Array.isArray(item.mainEntity) || item.mainEntity.length === 0) {
              schemaInfo.issues.push('Missing mainEntity array');
              detailedErrors.push({
                severity: 'high',
                category: 'Schema',
                issue: 'FAQPage missing questions',
                location: `Schema #${schemaInfo.index}`,
                fix: 'Add mainEntity array with Question objects',
                impact: 'FAQ rich results require questions'
              });
            }
          }
          
          if (type === 'LocalBusiness') {
            const missing = [];
            if (!item.name) missing.push('name');
            if (!item.address) missing.push('address');
            if (!item.telephone) missing.push('telephone');
            if (!item.url) missing.push('url');
            if (!item.openingHours && !item.openingHoursSpecification) {
              missing.push('openingHours');
            }
            if (missing.length > 0) {
              schemaInfo.issues.push(`Missing: ${missing.join(', ')}`);
              warnings.push({
                severity: 'medium',
                category: 'Schema',
                issue: `LocalBusiness schema incomplete`,
                location: `Schema #${schemaInfo.index}`,
                fix: `Add recommended fields: ${missing.join(', ')}`,
                impact: 'Enhanced business information in local search results'
              });
            }
          }
          
          if (type === 'BreadcrumbList') {
            if (!item.itemListElement || !Array.isArray(item.itemListElement)) {
              schemaInfo.issues.push('Missing itemListElement');
              detailedErrors.push({
                severity: 'medium',
                category: 'Schema',
                issue: 'BreadcrumbList missing items',
                location: `Schema #${schemaInfo.index}`,
                fix: 'Add itemListElement array with ListItem objects',
                impact: 'Breadcrumb rich results require list items'
              });
            }
          }
          
          if (type === 'WebSite') {
            if (item.potentialAction) {
              passed.push('WebSite schema with search action (Sitelinks Search Box)');
            }
          }
          
          schemas.push(schemaInfo);
        });
        
      } catch (e) {
        detailedErrors.push({
          severity: 'critical',
          category: 'Schema',
          issue: 'Invalid JSON in schema markup',
          location: `<script type="application/ld+json"> #${index + 1}`,
          fix: 'Fix JSON syntax errors - validate at json-ld.org/playground',
          details: e.message,
          impact: 'Broken schema is completely ignored'
        });
        schemas.push({ index: index + 1, type: 'Invalid JSON', valid: false });
      }
    });
    
    const validSchemas = schemas.filter(s => s.valid);
    const schemaTypes = validSchemas.map(s => s.type);

    // ==========================================
    // 10. OPEN GRAPH TAGS
    // ==========================================
    checksPerformed.push('Open Graph tags analysis');
    const ogTags = {
      title: doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
      description: doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
      image: doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
      url: doc.querySelector('meta[property="og:url"]')?.getAttribute('content') || '',
      type: doc.querySelector('meta[property="og:type"]')?.getAttribute('content') || '',
      siteName: doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || ''
    };
    
    const ogMissing = [];
    if (!ogTags.title) ogMissing.push('og:title');
    if (!ogTags.description) ogMissing.push('og:description');
    if (!ogTags.image) ogMissing.push('og:image');
    if (!ogTags.url) ogMissing.push('og:url');
    
    if (ogMissing.length > 0) {
      warnings.push({
        severity: 'medium',
        category: 'Social',
        issue: `Missing Open Graph tags: ${ogMissing.join(', ')}`,
        location: '<head>',
        fix: 'Add complete OG tags for better social sharing',
        impact: 'Links shared on social media may look incomplete'
      });
    } else {
      passed.push('Open Graph tags complete');
    }

    // ==========================================
    // 11. TWITTER CARD
    // ==========================================
    checksPerformed.push('Twitter Card validation');
    const twitterTags = {
      card: doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || '',
      title: doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || '',
      description: doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || '',
      image: doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || ''
    };
    
    if (!twitterTags.card) {
      warnings.push({
        severity: 'low',
        category: 'Social',
        issue: 'Missing Twitter Card meta tags',
        location: '<head>',
        fix: 'Add <meta name="twitter:card" content="summary_large_image">',
        impact: 'Twitter shares may not display optimally'
      });
    } else {
      passed.push(`Twitter Card: ${twitterTags.card}`);
    }

    // ==========================================
    // 12. IMAGE ANALYSIS
    // ==========================================
    checksPerformed.push('Image alt text audit');
    const imagesWithoutAlt = images.filter(img => {
      const alt = img.getAttribute('alt');
      return alt === null || alt === undefined;
    });
    const imagesWithEmptyAlt = images.filter(img => img.getAttribute('alt') === '');
    
    if (imagesWithoutAlt.length > 0) {
      detailedErrors.push({
        severity: 'high',
        category: 'Accessibility',
        issue: `${imagesWithoutAlt.length} image(s) missing alt attribute`,
        location: '<body>',
        fix: 'Add descriptive alt text to all content images',
        details: imagesWithoutAlt.slice(0, 3).map(img => img.getAttribute('src')).join(', '),
        impact: 'Screen readers cannot describe these images'
      });
    }
    
    if (imagesWithEmptyAlt.length > 0 && imagesWithEmptyAlt.length > images.length * 0.5) {
      warnings.push({
        severity: 'medium',
        category: 'Accessibility',
        issue: `${imagesWithEmptyAlt.length} image(s) have empty alt=""`,
        location: '<body>',
        fix: 'Empty alt is OK for decorative images, but content images need descriptions',
        impact: 'Verify these are truly decorative images'
      });
    }

    checksPerformed.push('Image dimensions check (CLS prevention)');
    const imagesWithoutDimensions = images.filter(img => 
      !img.hasAttribute('width') || !img.hasAttribute('height')
    );
    
    if (imagesWithoutDimensions.length > 0) {
      warnings.push({
        severity: 'medium',
        category: 'Performance',
        issue: `${imagesWithoutDimensions.length} image(s) without explicit dimensions`,
        location: '<body>',
        fix: 'Add width and height attributes to prevent Cumulative Layout Shift',
        impact: 'May cause CLS issues affecting Core Web Vitals'
      });
    }

    checksPerformed.push('Image lazy loading check');
    const lazyImages = images.filter(img => img.getAttribute('loading') === 'lazy');
    const aboveFoldImages = images.slice(0, 3);
    const lazyAboveFold = aboveFoldImages.filter(img => img.getAttribute('loading') === 'lazy');
    
    if (lazyAboveFold.length > 0) {
      warnings.push({
        severity: 'medium',
        category: 'Performance',
        issue: 'Above-fold images may be lazy loaded',
        location: '<body>',
        fix: 'Remove loading="lazy" from first visible images (LCP impact)',
        impact: 'May delay Largest Contentful Paint'
      });
    }

    // ==========================================
    // 13. MIXED CONTENT & SECURITY
    // ==========================================
    checksPerformed.push('Mixed content detection (HTTP/HTTPS)');
    const httpResources = [];
    
    if (sourceUrl?.startsWith('https://')) {
      images.forEach(img => {
        const src = img.getAttribute('src') || '';
        if (src.startsWith('http://')) {
          httpResources.push({ type: 'image', src });
        }
      });
      
      scripts.forEach(s => {
        const src = s.getAttribute('src') || '';
        if (src.startsWith('http://')) {
          httpResources.push({ type: 'script', src });
        }
      });
      
      stylesheets.forEach(l => {
        const href = l.getAttribute('href') || '';
        if (href.startsWith('http://')) {
          httpResources.push({ type: 'stylesheet', href });
        }
      });
      
      if (httpResources.length > 0) {
        detailedErrors.push({
          severity: 'critical',
          category: 'Security',
          issue: `${httpResources.length} HTTP resource(s) on HTTPS page`,
          location: '<body>',
          fix: 'Change all resources to HTTPS or use protocol-relative URLs',
          details: httpResources.slice(0, 3).map(r => r.src || r.href).join(', '),
          impact: 'Mixed content may be blocked by browsers'
        });
      }
    }

    checksPerformed.push('Protocol-relative URL detection');
    const protocolRelative = [];
    images.forEach(img => {
      const src = img.getAttribute('src') || '';
      if (src.startsWith('//')) protocolRelative.push(src);
    });
    
    if (protocolRelative.length > 0) {
      warnings.push({
        severity: 'low',
        category: 'Technical',
        issue: `${protocolRelative.length} protocol-relative URL(s) found`,
        location: '<body>',
        fix: 'Consider using explicit https:// for clarity',
        impact: 'Protocol-relative URLs work but are deprecated'
      });
    }

    // ==========================================
    // 14. LINK ANALYSIS
    // ==========================================
    checksPerformed.push('Internal/External link analysis');
    
    let internalLinks = 0;
    let externalLinks = 0;
    const brokenLinks = [];
    
    const sourceHost = sourceUrl ? new URL(sourceUrl).hostname : '';
    
    links.forEach(a => {
      const href = a.getAttribute('href') || '';
      
      // Check for broken/empty links
      if (!href || href === '#' || href === 'javascript:void(0)' || href === 'javascript:;') {
        brokenLinks.push(href || '(empty)');
      }
      
      // Classify internal vs external
      if (href.startsWith('http')) {
        try {
          const linkHost = new URL(href).hostname;
          if (linkHost === sourceHost) {
            internalLinks++;
          } else {
            externalLinks++;
          }
        } catch (e) {
          // Invalid URL
        }
      } else if (href.startsWith('/') || href.startsWith('./') || !href.includes(':')) {
        internalLinks++;
      }
    });
    
    if (brokenLinks.length > 0) {
      warnings.push({
        severity: 'medium',
        category: 'Links',
        issue: `${brokenLinks.length} empty/placeholder link(s) found`,
        location: '<body>',
        fix: 'Replace javascript:void(0) and # with real URLs or buttons',
        details: brokenLinks.slice(0, 5).join(', '),
        impact: 'Poor UX and potential accessibility issues'
      });
    }

    checksPerformed.push('Generic anchor text detection');
    const genericAnchors = links.filter(a => {
      const text = a.textContent.toLowerCase().trim();
      return ['click here', 'read more', 'here', 'learn more', 'more', 'link', 'this'].includes(text);
    });
    
    if (genericAnchors.length > 0) {
      warnings.push({
        severity: 'medium',
        category: 'Links',
        issue: `${genericAnchors.length} link(s) with generic anchor text`,
        location: '<body>',
        fix: 'Use descriptive anchor text with relevant keywords',
        details: genericAnchors.slice(0, 3).map(a => `"${a.textContent.trim()}"`).join(', '),
        impact: 'Missed opportunity for keyword relevance'
      });
    }

    checksPerformed.push('External link security check');
    const targetBlankLinks = links.filter(a => a.getAttribute('target') === '_blank');
    const unsafeExternal = targetBlankLinks.filter(a => {
      const rel = a.getAttribute('rel') || '';
      return !rel.includes('noopener');
    });
    
    if (unsafeExternal.length > 0) {
      warnings.push({
        severity: 'medium',
        category: 'Security',
        issue: `${unsafeExternal.length} external link(s) missing rel="noopener"`,
        location: '<body>',
        fix: 'Add rel="noopener noreferrer" to target="_blank" links',
        impact: 'Potential security vulnerability (reverse tabnabbing)'
      });
    }

    // ==========================================
    // 15. PERFORMANCE INDICATORS
    // ==========================================
    checksPerformed.push('Resource hints analysis');
    const preloads = Array.from(doc.querySelectorAll('link[rel="preload"]'));
    const preconnects = Array.from(doc.querySelectorAll('link[rel="preconnect"]'));
    const prefetches = Array.from(doc.querySelectorAll('link[rel="prefetch"]'));
    const dnsPrefetches = Array.from(doc.querySelectorAll('link[rel="dns-prefetch"]'));
    
    preloads.forEach((link, i) => {
      if (!link.getAttribute('as')) {
        warnings.push({
          severity: 'medium',
          category: 'Performance',
          issue: 'Preload link missing "as" attribute',
          location: `<head> preload #${i + 1}`,
          fix: 'Add as="font", as="style", as="script", etc.',
          impact: 'Browser may not prioritize correctly without as attribute'
        });
      }
    });

    checksPerformed.push('Render-blocking resources');
    const headScripts = Array.from(doc.querySelectorAll('head script[src]')).filter(s => 
      !s.hasAttribute('async') && !s.hasAttribute('defer')
    );
    const headStyles = Array.from(doc.querySelectorAll('head link[rel="stylesheet"]'));
    
    if (headScripts.length > 2) {
      warnings.push({
        severity: 'medium',
        category: 'Performance',
        issue: `${headScripts.length} render-blocking scripts in <head>`,
        location: '<head>',
        fix: 'Add async or defer attribute, or move to end of body',
        impact: 'May delay First Contentful Paint'
      });
    }

    // ==========================================
    // 16. CONTENT ANALYSIS
    // ==========================================
    checksPerformed.push('Word count & content analysis');
    const words = bodyText.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    
    // Calculate content-to-template ratio (main content vs nav/footer)
    const mainContent = doc.querySelector('main, article, [role="main"], .content, #content');
    const mainText = mainContent?.textContent?.trim() || '';
    const mainWords = mainText.split(/\s+/).filter(w => w.length > 0).length;
    const contentRatio = wordCount > 0 ? Math.round((mainWords / wordCount) * 100) : 0;
    
    // Only warn for thin content on content-heavy page types (articles, blogs)
    const isContentPage = doc.querySelector('article, .post, .blog, [itemtype*="Article"]');
    
    if (wordCount < 300 && isContentPage) {
      warnings.push({
        severity: 'low',
        category: 'Content',
        issue: `Low word count for content page (${wordCount} words)`,
        location: '<body>',
        fix: 'Consider adding more comprehensive content for article/blog pages',
        impact: 'May struggle for competitive informational queries (not always an issue)'
      });
    }

    checksPerformed.push('Duplicate content patterns');
    const paragraphs = Array.from(doc.querySelectorAll('p')).map(p => p.textContent.trim()).filter(p => p.length > 50);
    const duplicateParagraphs = paragraphs.filter((p, i, arr) => arr.indexOf(p) !== i);
    
    if (duplicateParagraphs.length > 0) {
      warnings.push({
        severity: 'low',
        category: 'Content',
        issue: `${duplicateParagraphs.length} duplicate paragraph(s) detected`,
        location: '<body>',
        fix: 'Remove or rewrite duplicate content',
        impact: 'Duplicate content provides no additional value'
      });
    }

    // ==========================================
    // 17. GENERIC/OVERUSED PHRASING DETECTION
    // ==========================================
    checksPerformed.push('Generic/overused phrasing analysis');
    const genericPhrases = [
      'delve into', 'delve deeper', 'dive into', 'dive deeper',
      'it is important to note', 'it is worth noting', 'it is crucial to',
      'in conclusion', 'to summarize', 'in summary',
      'moreover', 'furthermore', 'additionally', 'consequently',
      'leverage', 'utilize', 'facilitate', 'implement',
      'in today\'s digital landscape', 'in today\'s world', 'in this day and age',
      'game-changer', 'game changer', 'cutting-edge', 'cutting edge',
      'unlock the potential', 'unlock your potential', 'unleash',
      'seamlessly', 'effortlessly', 'streamline',
      'comprehensive guide', 'ultimate guide', 'complete guide',
      'crucial aspect', 'key aspect', 'important aspect',
      'plays a vital role', 'plays a crucial role', 'plays an important role',
      'embark on', 'embark upon', 'journey',
      'navigate the complexities', 'navigate through',
      'holistic approach', 'robust', 'scalable'
    ];
    
    const bodyTextLower = bodyText.toLowerCase();
    let genericScore = 0;
    const foundGenericPhrases = [];
    
    genericPhrases.forEach(phrase => {
      const regex = new RegExp(phrase, 'gi');
      const matches = bodyTextLower.match(regex);
      if (matches) {
        genericScore += matches.length * 5;
        foundGenericPhrases.push(`"${phrase}" (${matches.length}x)`);
      }
    });
    
    genericScore = Math.min(genericScore, 100);

    // ==========================================
    // 18. CMS/PLATFORM DETECTION
    // ==========================================
    checksPerformed.push('CMS/Platform detection');
    const cmsDetected = [];
    const htmlLower = html.toLowerCase();
    
    if (htmlLower.includes('wp-content') || htmlLower.includes('wp-includes')) cmsDetected.push('WordPress');
    if (htmlLower.includes('shopify') || htmlLower.includes('cdn.shopify')) cmsDetected.push('Shopify');
    if (htmlLower.includes('__next') || htmlLower.includes('_next/static')) cmsDetected.push('Next.js');
    if (htmlLower.includes('nuxt') || htmlLower.includes('__nuxt')) cmsDetected.push('Nuxt.js');
    if (htmlLower.includes('gatsby')) cmsDetected.push('Gatsby');
    if (htmlLower.includes('wix.com') || htmlLower.includes('wixstatic')) cmsDetected.push('Wix');
    if (htmlLower.includes('squarespace')) cmsDetected.push('Squarespace');
    if (htmlLower.includes('webflow')) cmsDetected.push('Webflow');
    if (htmlLower.includes('drupal') || htmlLower.includes('/sites/default/files')) cmsDetected.push('Drupal');
    if (htmlLower.includes('joomla')) cmsDetected.push('Joomla');
    if (htmlLower.includes('magento') || htmlLower.includes('mage/')) cmsDetected.push('Magento');
    if (htmlLower.includes('prestashop')) cmsDetected.push('PrestaShop');
    if (htmlLower.includes('bigcommerce')) cmsDetected.push('BigCommerce');
    if (htmlLower.includes('ghost')) cmsDetected.push('Ghost');
    if (htmlLower.includes('hubspot')) cmsDetected.push('HubSpot');
    if (htmlLower.includes('contentful')) cmsDetected.push('Contentful');
    if (htmlLower.includes('sanity.io')) cmsDetected.push('Sanity');

    // ==========================================
    // 19. RENDERING METHOD DETECTION
    // ==========================================
    checksPerformed.push('Rendering method detection');
    
    let renderMethod = 'Unknown';
    const hasSubstantialContent = bodyText.length > 500;
    const hasReactRoot = doc.querySelector('#root') || doc.querySelector('#__next') || doc.querySelector('#app');
    const hasEmptyRoot = hasReactRoot && hasReactRoot.innerHTML.trim().length < 50;
    
    if (hasEmptyRoot || (!hasSubstantialContent && hasReactRoot)) {
      renderMethod = 'Client-Side Rendered (CSR)';
      warnings.push({
        severity: 'high',
        category: 'Technical',
        issue: 'Page appears to be Client-Side Rendered',
        location: '<body>',
        fix: 'Consider Server-Side Rendering (SSR) or Static Generation for SEO',
        impact: 'Googlebot may not fully render JavaScript content'
      });
    } else if (hasSubstantialContent) {
      renderMethod = 'Server-Side Rendered (SSR) or Static';
    }

    // ==========================================
    // 20. FAVICON & MISC
    // ==========================================
    checksPerformed.push('Favicon presence');
    const favicon = doc.querySelector('link[rel*="icon"]');
    const appleTouchIcon = doc.querySelector('link[rel="apple-touch-icon"]');
    
    if (!favicon) {
      warnings.push({
        severity: 'low',
        category: 'Technical',
        issue: 'No favicon detected',
        location: '<head>',
        fix: 'Add <link rel="icon" href="/favicon.ico">',
        impact: 'Browser tabs and bookmarks will show generic icon'
      });
    }

    // ==========================================
    // 21. SITEMAP REFERENCE CHECK
    // ==========================================
    checksPerformed.push('Sitemap reference check');
    const sitemapLink = doc.querySelector('link[rel="sitemap"]');
    if (sitemapLink) {
      passed.push('Sitemap reference found in HTML');
    }
    
    // Note: Actual sitemap.xml and robots.txt validation is done separately
    // and results are merged in handleAnalyze

    // ==========================================
    // 22. TRUST SIGNALS (E-E-A-T)
    // ==========================================
    checksPerformed.push('Trust signals analysis (E-E-A-T)');
    
    // Check for author information
    const authorSchema = schemas.some(s => s.type === 'Person' || (s.data?.author));
    const authorMeta = doc.querySelector('meta[name="author"]')?.getAttribute('content');
    const authorElement = doc.querySelector('.author, [rel="author"], [itemprop="author"]');
    const hasAuthor = authorSchema || authorMeta || authorElement;
    
    // Check for About/Contact pages
    const aboutLink = links.some(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      const text = (a.textContent || '').toLowerCase();
      return href.includes('about') || href.includes('team') || 
             text.includes('about') || text.includes('who we are');
    });
    
    const contactLink = links.some(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      const text = (a.textContent || '').toLowerCase();
      return href.includes('contact') || text.includes('contact');
    });
    
    // Check for social links
    const socialLinks = links.filter(a => {
      const href = (a.getAttribute('href') || '').toLowerCase();
      return href.includes('facebook.com') || href.includes('twitter.com') || 
             href.includes('linkedin.com') || href.includes('instagram.com') ||
             href.includes('youtube.com') || href.includes('x.com');
    });
    
    // Article pages should have author
    const isArticlePage = doc.querySelector('article, [itemtype*="Article"], [itemtype*="BlogPosting"]');
    if (isArticlePage && !hasAuthor) {
      warnings.push({
        severity: 'medium',
        category: 'E-E-A-T',
        issue: 'Article page missing author information',
        location: '<body>',
        fix: 'Add author name, bio, and link to author page for credibility',
        impact: 'Author attribution helps establish expertise and trust'
      });
    }
    
    if (aboutLink) passed.push('About page link found');
    if (contactLink) passed.push('Contact page link found');
    if (socialLinks.length > 0) passed.push(`Social links found (${socialLinks.length})`);

    // ==========================================
    // 23. FONT LOADING STRATEGY
    // ==========================================
    checksPerformed.push('Font loading strategy (font-display)');
    const fontFaces = html.match(/@font-face\s*{[^}]*}/gi) || [];
    const fontsWithoutDisplay = fontFaces.filter(ff => !ff.includes('font-display'));
    
    const preloadFonts = preloads.filter(l => 
      l.getAttribute('as') === 'font' || 
      (l.getAttribute('href') || '').match(/\.(woff2?|ttf|otf|eot)/)
    );
    
    if (fontFaces.length > 0 && fontsWithoutDisplay.length > 0) {
      warnings.push({
        severity: 'low',
        category: 'Performance',
        issue: `${fontsWithoutDisplay.length} @font-face rules missing font-display`,
        location: '<style>',
        fix: 'Add font-display: swap (or optional) to prevent FOIT',
        impact: 'May cause Flash of Invisible Text during font loading'
      });
    }
    
    if (preloadFonts.length > 0) {
      passed.push(`Font preloading configured (${preloadFonts.length} fonts)`);
    }

    // ==========================================
    // 24. HREFLANG + CANONICAL CONFLICT CHECK
    // ==========================================
    if (hreflangs.length > 0 && canonicalHref) {
      checksPerformed.push('Hreflang and canonical consistency');
      
      // Check if canonical conflicts with hreflang
      const canonicalInHreflang = hreflangs.some(h => 
        h.href?.replace(/\/$/, '') === canonicalHref.replace(/\/$/, '')
      );
      
      if (!canonicalInHreflang) {
        warnings.push({
          severity: 'high',
          category: 'International',
          issue: 'Canonical URL not found in hreflang tags',
          location: '<head>',
          fix: 'Ensure canonical URL is included in hreflang set',
          current: `Canonical: ${canonicalHref}`,
          impact: 'May cause indexing confusion for international pages'
        });
      }
    }

    // ==========================================
    // 25. LANGUAGE CONSISTENCY CHECK
    // ==========================================
    if (htmlLang && hreflangs.length > 0) {
      checksPerformed.push('Language attribute consistency');
      
      // Find if current page's lang matches any hreflang
      const langCode = htmlLang.toLowerCase().split('-')[0];
      const matchingHreflang = hreflangs.find(h => {
        const hreflangCode = h.hreflang?.toLowerCase().split('-')[0];
        return hreflangCode === langCode || h.hreflang === 'x-default';
      });
      
      if (!matchingHreflang) {
        warnings.push({
          severity: 'medium',
          category: 'International',
          issue: `HTML lang="${htmlLang}" doesn't match any hreflang`,
          location: '<html>',
          fix: 'Ensure HTML lang attribute matches one of the hreflang values',
          impact: 'Inconsistent language signals to search engines'
        });
      }
    }

    // ==========================================
    // 26. STRUCTURED DATA COMPLETENESS
    // ==========================================
    checksPerformed.push('Business/organization info completeness');
    
    // Check for address consistency
    const addressSchema = schemas.find(s => 
      s.data?.address || s.type === 'LocalBusiness' || s.type === 'Organization'
    );
    const addressMicrodata = doc.querySelector('[itemprop="address"], [itemtype*="PostalAddress"]');
    
    if (addressSchema || addressMicrodata) {
      passed.push('Business address structured data found');
    }

    // ==========================================
    // COMPILE RESULTS
    // ==========================================
    const allIssues = [...detailedErrors, ...warnings];
    
    return {
      url: sourceUrl,
      timestamp: new Date().toISOString(),
      checksPerformed,
      passed,
      summary: {
        totalChecks: checksPerformed.length,
        passed: passed.length,
        issuesFound: allIssues.length,
        criticalIssues: allIssues.filter(e => e.severity === 'critical').length,
        highIssues: allIssues.filter(e => e.severity === 'high').length,
        mediumIssues: allIssues.filter(e => e.severity === 'medium').length,
        lowIssues: allIssues.filter(e => e.severity === 'low').length
      },
      score: Math.max(0, 100 - (
        allIssues.filter(e => e.severity === 'critical').length * 20 +
        allIssues.filter(e => e.severity === 'high').length * 10 +
        allIssues.filter(e => e.severity === 'medium').length * 5 +
        allIssues.filter(e => e.severity === 'low').length * 2
      )),
      technical: {
        title: { value: title, length: title.length },
        metaDesc: { value: metaDesc, length: metaDesc.length },
        viewport: !!viewport,
        charset: !!charset,
        htmlLang,
        canonical: { count: canonicals.length, href: canonicalHref },
        robotsMeta,
        favicon: !!favicon,
        appleTouchIcon: !!appleTouchIcon
      },
      international: {
        hreflangs,
        hreflangIssues,
        hasXDefault: hreflangs.some(h => h.hreflang === 'x-default')
      },
      schema: {
        count: schemas.length,
        types: schemaTypes,
        valid: validSchemas.length,
        details: schemas
      },
      social: {
        og: ogTags,
        twitter: twitterTags,
        ogComplete: ogMissing.length === 0
      },
      content: {
        headings,
        wordCount,
        duplicateParagraphs: duplicateParagraphs.length,
        genericScore,
        genericPhrases: foundGenericPhrases
      },
      images: {
        total: images.length,
        withoutAlt: imagesWithoutAlt.length,
        emptyAlt: imagesWithEmptyAlt.length,
        withoutDimensions: imagesWithoutDimensions.length,
        lazyLoaded: lazyImages.length
      },
      links: {
        total: links.length,
        internal: internalLinks,
        external: externalLinks,
        broken: brokenLinks.length,
        genericAnchors: genericAnchors.length,
        unsafeExternal: unsafeExternal.length
      },
      performance: {
        preloads: preloads.length,
        preconnects: preconnects.length,
        prefetches: prefetches.length,
        dnsPrefetches: dnsPrefetches.length,
        renderBlockingScripts: headScripts.length,
        totalScripts: scripts.length,
        totalStylesheets: stylesheets.length
      },
      platform: {
        cms: cmsDetected,
        renderMethod
      },
      security: {
        https: sourceUrl?.startsWith('https://'),
        mixedContent: httpResources.length,
        protocolRelative: protocolRelative.length
      },
      trustSignals: {
        hasAuthor,
        hasAboutPage: aboutLink,
        hasContactPage: contactLink,
        socialLinksCount: socialLinks.length
      },
      detailedErrors,
      warnings
    };
  };

  // Claude AI Analysis
  const runAIAnalysis = async (results, htmlSnippet) => {
    setAiLoading(true);
    
    try {
      const prompt = `You are an expert SEO consultant. Analyze this website audit data and provide actionable recommendations.

URL: ${results.url}
SEO Score: ${results.score}/100

Key Findings:
- Title: "${results.technical.title.value}" (${results.technical.title.length} chars)
- Meta Description: "${results.technical.metaDesc.value.substring(0, 100)}..." (${results.technical.metaDesc.length} chars)
- H1 Tags: ${results.content.headings.h1.join(', ') || 'None'}
- Word Count: ${results.content.wordCount}
- Images: ${results.images.total} total, ${results.images.withoutAlt} missing alt
- Links: ${results.links.internal} internal, ${results.links.external} external
- Schema Types: ${results.schema.types.join(', ') || 'None'}
- Critical Issues: ${results.summary.criticalIssues}
- High Priority Issues: ${results.summary.highIssues}
- Platform: ${results.platform.cms.join(', ') || 'Unknown'}
- Rendering: ${results.platform.renderMethod}

Top Issues Found:
${[...results.detailedErrors, ...results.warnings].slice(0, 7).map(e => `- [${e.severity.toUpperCase()}] ${e.issue}`).join('\n')}

Passed Checks:
${results.passed.slice(0, 5).map(p => `- ✓ ${p}`).join('\n')}

Provide a JSON response with this exact structure:
{
  "overallAssessment": "2-3 sentence summary of page SEO health - be specific about what's good and what needs work",
  "topPriorities": ["priority 1 with specific action", "priority 2 with specific action", "priority 3 with specific action"],
  "quickWins": ["quick win that can be done in <5 min", "another quick win", "third quick win"],
  "titleSuggestion": "improved title suggestion if current one has issues, or null if it's good",
  "metaDescSuggestion": "improved meta description if needed, or null if it's good",
  "contentRecommendations": ["specific content rec based on findings", "another content rec"],
  "technicalRecommendations": ["specific technical rec", "another technical rec"],
  "competitiveInsight": "one actionable insight about how to improve competitiveness"
}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          temperature: 0,
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();
      const text = data.content?.find(c => c.type === 'text')?.text || '';
      
      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        setAiAnalysis(analysis);
      } else {
        setAiAnalysis({ overallAssessment: text, error: false });
      }
    } catch (err) {
      console.error('AI Analysis error:', err);
      setAiAnalysis({ 
        overallAssessment: 'AI analysis unavailable. Please review the detailed findings above.',
        error: true 
      });
    } finally {
      setAiLoading(false);
    }
  };

  // Main analyze handler
  const handleAnalyze = async () => {
    setError('');
    setResults(null);
    setAiAnalysis(null);
    setLoading(true);
    setFetchStatus('');
    
    try {
      let html = '';
      let sourceUrl = url || 'https://example.com';
      let robotsTxt = null;
      let sitemapExists = null;
      
      if (inputMode === 'url') {
        if (!url || !url.startsWith('http')) {
          throw new Error('Please enter a valid URL starting with http:// or https://');
        }
        
        let fetchResult = null;
        let usedBackend = false;
        
        // Try backend API first (if configured)
        if (BACKEND_API_URL) {
          try {
            fetchResult = await fetchWithBackend(url);
            html = fetchResult.html;
            sourceUrl = fetchResult.finalUrl || url;
            robotsTxt = fetchResult.robotsTxt;
            sitemapExists = fetchResult.sitemapAccessible;
            usedBackend = true;
          } catch (backendError) {
            console.log('Backend fetch failed, falling back to CORS proxies:', backendError.message);
            setFetchStatus('Backend unavailable, trying CORS proxies...');
          }
        }
        
        // Fall back to CORS proxy method
        if (!usedBackend) {
          html = await fetchWithProxy(url);
          sourceUrl = url;
          
          // Try to fetch robots.txt and check sitemap (non-blocking)
          setFetchStatus('Checking robots.txt and sitemap...');
          try {
            const baseUrl = new URL(url).origin;
            [robotsTxt, sitemapExists] = await Promise.all([
              fetchRobotsTxt(baseUrl),
              checkSitemap(baseUrl)
            ]);
          } catch (e) {
            // Ignore errors for these optional checks
          }
        }
        
      } else {
        if (!htmlSource || htmlSource.length < 100) {
          throw new Error('Please paste complete HTML source (minimum 100 characters)');
        }
        html = htmlSource;
        
        // Auto-detect URL from HTML content
        const tempParser = new DOMParser();
        const tempDoc = tempParser.parseFromString(html, 'text/html');
        
        // Try to extract URL from canonical, og:url, or base tag
        const detectedCanonical = tempDoc.querySelector('link[rel="canonical"]')?.getAttribute('href');
        const detectedOgUrl = tempDoc.querySelector('meta[property="og:url"]')?.getAttribute('content');
        const detectedBase = tempDoc.querySelector('base')?.getAttribute('href');
        
        // Use user-provided URL first, then auto-detected, then fallback
        sourceUrl = url || detectedCanonical || detectedOgUrl || detectedBase || 'https://example.com';
        
        // Update the URL field if we detected one and user didn't provide
        if (!url && (detectedCanonical || detectedOgUrl)) {
          setUrl(detectedCanonical || detectedOgUrl);
        }
      }
      
      setFetchStatus('Analyzing HTML...');
      const analysis = analyzeHTML(html, sourceUrl);
      
      // Add robots.txt analysis if available
      if (robotsTxt) {
        analysis.checksPerformed.push('robots.txt validation');
        analysis.robotsTxt = {
          found: true,
          content: robotsTxt.substring(0, 500),
          hasDisallowAll: robotsTxt.includes('Disallow: /') && !robotsTxt.includes('Disallow: /')
        };
        
        // Check for common robots.txt issues
        if (robotsTxt.toLowerCase().includes('disallow: /')) {
          const lines = robotsTxt.split('\n');
          const disallowAll = lines.some(line => {
            const trimmed = line.trim().toLowerCase();
            return trimmed === 'disallow: /' || trimmed === 'disallow:/' ;
          });
          
          if (disallowAll) {
            analysis.detailedErrors.push({
              severity: 'critical',
              category: 'Technical',
              issue: 'robots.txt blocks all crawling (Disallow: /)',
              location: '/robots.txt',
              fix: 'Remove or modify "Disallow: /" to allow search engine crawling',
              impact: 'Site will NOT be indexed by search engines'
            });
            analysis.summary.criticalIssues++;
          }
        }
        
        // Check if sitemap is referenced in robots.txt
        if (!robotsTxt.toLowerCase().includes('sitemap:')) {
          analysis.warnings.push({
            severity: 'medium',
            category: 'Technical',
            issue: 'No sitemap reference in robots.txt',
            location: '/robots.txt',
            fix: 'Add "Sitemap: https://yoursite.com/sitemap.xml" to robots.txt',
            impact: 'Search engines may not discover your sitemap automatically'
          });
          analysis.summary.mediumIssues++;
        } else {
          analysis.passed.push('Sitemap referenced in robots.txt');
        }
        
        analysis.passed.push('robots.txt found and accessible');
      } else if (inputMode === 'url') {
        analysis.checksPerformed.push('robots.txt check');
        analysis.robotsTxt = { found: false };
        analysis.warnings.push({
          severity: 'low',
          category: 'Technical',
          issue: 'robots.txt not found or not accessible',
          location: '/robots.txt',
          fix: 'Create a robots.txt file in your site root',
          impact: 'Missing robots.txt is not critical but recommended'
        });
        analysis.summary.lowIssues++;
      }
      
      // Add sitemap check results
      if (sitemapExists === true) {
        analysis.checksPerformed.push('sitemap.xml accessibility');
        analysis.sitemap = { accessible: true };
        analysis.passed.push('sitemap.xml found and accessible');
      } else if (sitemapExists === false && inputMode === 'url') {
        analysis.checksPerformed.push('sitemap.xml check');
        analysis.sitemap = { accessible: false };
        analysis.warnings.push({
          severity: 'medium',
          category: 'Technical',
          issue: 'sitemap.xml not found at standard location',
          location: '/sitemap.xml',
          fix: 'Create an XML sitemap and submit to Google Search Console',
          impact: 'Sitemap helps search engines discover and index pages faster'
        });
        analysis.summary.mediumIssues++;
      }
      
      // Recalculate score after adding robots/sitemap issues
      analysis.score = Math.max(0, 100 - (
        analysis.detailedErrors.filter(e => e.severity === 'critical').length * 20 +
        analysis.detailedErrors.filter(e => e.severity === 'high').length * 10 +
        [...analysis.detailedErrors, ...analysis.warnings].filter(e => e.severity === 'medium').length * 5 +
        [...analysis.detailedErrors, ...analysis.warnings].filter(e => e.severity === 'low').length * 2
      ));
      
      setResults(analysis);
      
      // Expand important sections by default
      setExpandedSections({
        issues: true,
        passed: false,
        technical: true,
        content: true
      });
      
      // Auto-run AI analysis
      runAIAnalysis(analysis, html.substring(0, 5000));
      
    } catch (err) {
      if (inputMode === 'url') {
        // Auto-switch to HTML paste mode
        setInputMode('html');
        setUrl(url); // Keep the URL for canonical validation
        
        const isAntiBot = err.message === 'ANTIBOT';
        setError(
          `⚠️ ${isAntiBot ? 'Site has anti-bot protection (Cloudflare/WAF)' : 'Could not fetch URL via proxies'}\n\n` +
          `This is common - most modern sites block automated requests.\n\n` +
          `✅ SOLUTION (takes 10 seconds):\n` +
          `1. Open ${url || 'your page'} in a new tab\n` +
          `2. Press Ctrl+U (Win) or Cmd+Option+U (Mac) to view source\n` +
          `3. Press Ctrl+A then Ctrl+C to copy all\n` +
          `4. Paste in the box below and click "Analyze HTML"\n\n` +
          `💡 Or drag & drop the saved HTML file into the text area.\n\n` +
          `I've switched to HTML paste mode for you 👇`
        );
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setFetchStatus('');
    }
  };

  // Export to JSON
  const exportJSON = () => {
    if (!results) return;
    const dataStr = JSON.stringify({ audit: results, aiAnalysis }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-audit-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // Export to CSV
  const exportCSV = () => {
    if (!results) return;
    const allIssues = [...results.detailedErrors, ...results.warnings];
    const csvRows = [
      ['Severity', 'Category', 'Issue', 'Location', 'Fix', 'Impact'],
      ...allIssues.map(i => [
        i.severity,
        i.category,
        `"${i.issue.replace(/"/g, '""')}"`,
        i.location,
        `"${i.fix.replace(/"/g, '""')}"`,
        i.impact || ''
      ])
    ];
    const csv = csvRows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-issues-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Copy results
  const copyResults = () => {
    if (!results) return;
    const text = `SEO Audit Report - ${results.url}\nScore: ${results.score}/100\n\nIssues:\n${
      [...results.detailedErrors, ...results.warnings]
        .map(i => `[${i.severity.toUpperCase()}] ${i.issue}\n  Fix: ${i.fix}`)
        .join('\n\n')
    }`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Demo HTML
  const loadDemo = () => {
    const demo = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Demo Page</title>
  <meta name="description" content="Short desc">
  <link rel="canonical" href="https://example.com/demo">
  <link rel="canonical" href="https://example.com/other">
  <link rel="alternate" hreflang="en-us" href="https://example.com/en">
  <link rel="alternate" hreflang="es" href="/es/demo">
  <script type="application/ld+json">{"@type":"Product","name":"Test"}</script>
</head>
<body>
  <h1>Demo Page</h1>
  <h1>Second H1</h1>
  <h3>Skipped H2</h3>
  <p>This is a demo page to test the SEO audit tool. It delve into various aspects and moreover demonstrates common issues. It is important to note that this is just a test. Furthermore, we leverage this to show problems.</p>
  <img src="http://example.com/image.jpg">
  <img src="//example.com/image2.jpg" alt="">
  <img src="test.png">
  <a href="#">Click here</a>
  <a href="javascript:void(0)">Read more</a>
  <a href="https://external.com" target="_blank">External</a>
</body>
</html>`;
    setHtmlSource(demo);
    setUrl('https://example.com/demo');
    setInputMode('html');
  };

  // Severity badge component
  const SeverityBadge = ({ severity }) => {
    const colors = {
      critical: 'bg-red-600 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-amber-500 text-white',
      low: 'bg-blue-500 text-white'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${colors[severity]}`}>
        {severity}
      </span>
    );
  };

  // Score circle component with accessibility
  const ScoreCircle = ({ score }) => {
    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
    const label = score >= 80 ? 'Good' : score >= 60 ? 'Needs Improvement' : score >= 40 ? 'Poor' : 'Critical';
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (score / 100) * circumference;
    
    return (
      <div 
        className="relative w-32 h-32" 
        role="img" 
        aria-label={`SEO Score: ${score} out of 100 - ${label}`}
      >
        <svg className="w-32 h-32 transform -rotate-90" aria-hidden="true">
          <circle cx="64" cy="64" r="45" stroke="#e5e7eb" strokeWidth="8" fill="none" />
          <circle 
            cx="64" cy="64" r="45" 
            stroke={color} 
            strokeWidth="8" 
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-slate-500">{label}</span>
        </div>
      </div>
    );
  };

  // Collapsible section component with ARIA accessibility
  const Section = ({ title, icon: Icon, children, id, defaultOpen = false, badge = null }) => {
    const isOpen = expandedSections[id] ?? defaultOpen;
    const contentId = `section-content-${id}`;
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <button
          onClick={() => toggleSection(id)}
          className="w-full px-5 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
          aria-expanded={isOpen}
          aria-controls={contentId}
        >
          <div className="flex items-center gap-3">
            {Icon && <Icon className="w-5 h-5 text-slate-600" aria-hidden="true" />}
            <span className="font-semibold text-slate-800">{title}</span>
            {badge}
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" aria-hidden="true" />
          )}
        </button>
        {isOpen && (
          <div id={contentId} className="p-5 border-t border-slate-200" role="region" aria-labelledby={`section-title-${id}`}>
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">SEO Audit Tool Pro</h1>
              <p className="text-emerald-100 mt-1">Browser-based on-page SEO analysis with AI insights</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm bg-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>45+ Checks</span>
              </div>
              <div className="text-sm bg-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
                <Brain className="w-4 h-4" />
                <span>AI Powered</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex gap-3 mb-5">
            <button
              onClick={() => {
                setInputMode('url');
                setResults(null);
                setAiAnalysis(null);
                setError('');
              }}
              className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all ${
                inputMode === 'url' 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Globe className="w-4 h-4" />
              Fetch URL
            </button>
            <button
              onClick={() => {
                setInputMode('html');
                setResults(null);
                setAiAnalysis(null);
                setError('');
              }}
              className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all ${
                inputMode === 'html' 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Code className="w-4 h-4" />
              Paste HTML
            </button>
            <button
              onClick={loadDemo}
              className="px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 bg-purple-100 text-purple-700 hover:bg-purple-200 transition-all ml-auto"
            >
              <FileText className="w-4 h-4" />
              Load Demo
            </button>
          </div>

          {inputMode === 'url' ? (
            <div>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/page"
                    className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  />
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={loading || !url}
                  className="px-8 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{fetchStatus || 'Analyzing...'}</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      <span>Analyze</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-3 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Uses CORS proxies to fetch pages. Many sites with Cloudflare/bot protection will block this — 
                  if it fails, you'll be auto-switched to "Paste HTML" mode (recommended for reliability).
                </span>
              </p>
            </div>
          ) : (
            <div>
              <div className="flex gap-3 mb-4">
                <div className="flex-1 relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="URL will be auto-detected from canonical/og:url"
                    className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:border-emerald-500 outline-none"
                  />
                </div>
                {(url || htmlSource || results) && (
                  <button
                    onClick={() => {
                      setUrl('');
                      setHtmlSource('');
                      setResults(null);
                      setAiAnalysis(null);
                      setError('');
                    }}
                    className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2"
                  >
                    <XCircle className="w-5 h-5" />
                    Clear
                  </button>
                )}
              </div>
              <div className="relative">
                <textarea
                  value={htmlSource}
                  onChange={(e) => {
                    setHtmlSource(e.target.value);
                    // Clear old results when HTML changes significantly
                    if (results && Math.abs(e.target.value.length - htmlSource.length) > 500) {
                      setResults(null);
                      setAiAnalysis(null);
                    }
                  }}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  placeholder="Paste complete HTML source here...

How to get HTML:
1. Visit the page you want to audit
2. Press Ctrl+U (Windows) or Cmd+Option+U (Mac)
3. Select all (Ctrl+A) and copy (Ctrl+C)
4. Paste here

💡 Or drag & drop a saved HTML file here!

💡 URL will be auto-detected from canonical or og:url tags"
                  className={`w-full h-48 px-4 py-3 border-2 rounded-xl font-mono text-sm focus:border-emerald-500 outline-none resize-none transition-all ${
                    isDragging 
                      ? 'border-emerald-500 bg-emerald-50 border-dashed' 
                      : 'border-slate-200'
                  }`}
                />
                {isDragging && (
                  <div className="absolute inset-0 flex items-center justify-center bg-emerald-50/80 rounded-xl pointer-events-none">
                    <div className="text-emerald-600 font-semibold flex items-center gap-2">
                      <Download className="w-6 h-6" />
                      Drop HTML file here
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-slate-500">
                  {htmlSource ? `${htmlSource.length.toLocaleString()} characters` : 'No HTML pasted'}
                </span>
                <button
                  onClick={handleAnalyze}
                  disabled={loading || !htmlSource}
                  className="px-8 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                  Analyze HTML
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <pre className="text-red-700 text-sm whitespace-pre-wrap font-sans">{error}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-6">
            {/* Score & Summary */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <ScoreCircle score={results.score} />
                
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">
                    {results.url || 'Page'} Audit Results
                  </h2>
                  <p className="text-slate-600 mb-4">
                    Performed {results.summary.totalChecks} checks • Found {results.summary.issuesFound} issues
                  </p>
                  
                  <div className="flex flex-wrap gap-3">
                    {results.summary.criticalIssues > 0 && (
                      <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                        {results.summary.criticalIssues} Critical
                      </span>
                    )}
                    {results.summary.highIssues > 0 && (
                      <span className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                        {results.summary.highIssues} High
                      </span>
                    )}
                    {results.summary.mediumIssues > 0 && (
                      <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                        {results.summary.mediumIssues} Medium
                      </span>
                    )}
                    {results.summary.lowIssues > 0 && (
                      <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {results.summary.lowIssues} Low
                      </span>
                    )}
                    <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                      {results.passed.length} Passed
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={exportJSON}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all flex items-center gap-2 text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Export JSON
                  </button>
                  <button
                    onClick={exportCSV}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all flex items-center gap-2 text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                  <button
                    onClick={copyResults}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all flex items-center gap-2 text-sm font-medium"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* AI Analysis */}
            {(aiLoading || aiAnalysis) && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl shadow-xl p-6 border border-purple-200">
                <div className="flex items-center gap-3 mb-4">
                  <Brain className="w-6 h-6 text-purple-600" />
                  <h2 className="text-xl font-bold text-purple-900">AI Analysis</h2>
                  {aiLoading && <Loader2 className="w-5 h-5 animate-spin text-purple-600" />}
                </div>
                
                {aiAnalysis && !aiAnalysis.error && (
                  <div className="space-y-4">
                    <p className="text-slate-700">{aiAnalysis.overallAssessment}</p>
                    
                    {aiAnalysis.topPriorities && (
                      <div>
                        <h3 className="font-semibold text-purple-900 mb-2">Top Priorities</h3>
                        <ul className="space-y-1">
                          {aiAnalysis.topPriorities.map((p, i) => (
                            <li key={i} className="flex items-start gap-2 text-slate-700">
                              <span className="text-purple-600 font-bold">{i + 1}.</span> {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {aiAnalysis.quickWins && (
                      <div>
                        <h3 className="font-semibold text-purple-900 mb-2">Quick Wins</h3>
                        <ul className="space-y-1">
                          {aiAnalysis.quickWins.map((w, i) => (
                            <li key={i} className="flex items-start gap-2 text-slate-700">
                              <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" /> {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {(aiAnalysis.titleSuggestion || aiAnalysis.metaDescSuggestion) && (
                      <div className="bg-white rounded-lg p-4 border border-purple-200">
                        <h3 className="font-semibold text-purple-900 mb-2">Suggested Improvements</h3>
                        {aiAnalysis.titleSuggestion && (
                          <div className="mb-2">
                            <span className="text-sm text-slate-500">Title:</span>
                            <p className="text-slate-800 font-medium">{aiAnalysis.titleSuggestion}</p>
                          </div>
                        )}
                        {aiAnalysis.metaDescSuggestion && (
                          <div>
                            <span className="text-sm text-slate-500">Meta Description:</span>
                            <p className="text-slate-800">{aiAnalysis.metaDescSuggestion}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {aiAnalysis?.error && (
                  <p className="text-slate-600">{aiAnalysis.overallAssessment}</p>
                )}
              </div>
            )}

            {/* Issues */}
            <Section
              title="Issues Found"
              icon={AlertTriangle}
              id="issues"
              defaultOpen={true}
              badge={
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  {results.summary.issuesFound}
                </span>
              }
            >
              <div className="space-y-3">
                {[...results.detailedErrors, ...results.warnings]
                  .sort((a, b) => {
                    const order = { critical: 0, high: 1, medium: 2, low: 3 };
                    return order[a.severity] - order[b.severity];
                  })
                  .map((issue, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-lg border-l-4 ${
                        issue.severity === 'critical' ? 'bg-red-50 border-red-500' :
                        issue.severity === 'high' ? 'bg-orange-50 border-orange-500' :
                        issue.severity === 'medium' ? 'bg-amber-50 border-amber-500' :
                        'bg-blue-50 border-blue-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <SeverityBadge severity={issue.severity} />
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs">
                          {issue.category}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800 mb-1">{issue.issue}</p>
                      <p className="text-sm text-slate-600 mb-2">📍 {issue.location}</p>
                      <p className="text-sm">
                        <span className="font-medium text-slate-700">Fix:</span>{' '}
                        <span className="text-slate-600">{issue.fix}</span>
                      </p>
                      {issue.impact && (
                        <p className="text-sm mt-1 text-slate-500 italic">Impact: {issue.impact}</p>
                      )}
                      {issue.current && (
                        <p className="text-sm mt-1 text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">
                          Current: {issue.current}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </Section>

            {/* Passed Checks */}
            <Section
              title="Passed Checks"
              icon={CheckCircle}
              id="passed"
              badge={
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  {results.passed.length}
                </span>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {results.passed.map((check, i) => (
                  <div key={i} className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">{check}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Technical Overview */}
            <Section title="Technical SEO" icon={Code} id="technical">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="text-sm text-slate-500 mb-1">Title Tag</div>
                    <div className="font-medium text-slate-800 truncate">{results.technical.title.value || '(empty)'}</div>
                    <div className="text-xs text-slate-500">{results.technical.title.length} characters</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="text-sm text-slate-500 mb-1">Meta Description</div>
                    <div className="font-medium text-slate-800 text-sm">{results.technical.metaDesc.value || '(empty)'}</div>
                    <div className="text-xs text-slate-500">{results.technical.metaDesc.length} characters</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="text-sm text-slate-500 mb-1">Canonical URL</div>
                    <div className="font-medium text-slate-800 text-sm truncate">
                      {results.technical.canonical.href || '(not set)'}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-lg ${results.technical.viewport ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="text-sm text-slate-600">Viewport</div>
                      <div className={`font-semibold ${results.technical.viewport ? 'text-green-700' : 'text-red-700'}`}>
                        {results.technical.viewport ? '✓ Set' : '✗ Missing'}
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${results.technical.charset ? 'bg-green-50' : 'bg-amber-50'}`}>
                      <div className="text-sm text-slate-600">Charset</div>
                      <div className={`font-semibold ${results.technical.charset ? 'text-green-700' : 'text-amber-700'}`}>
                        {results.technical.charset ? '✓ Set' : '✗ Missing'}
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${results.technical.htmlLang ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="text-sm text-slate-600">Language</div>
                      <div className={`font-semibold ${results.technical.htmlLang ? 'text-green-700' : 'text-red-700'}`}>
                        {results.technical.htmlLang || 'Not set'}
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${results.technical.favicon ? 'bg-green-50' : 'bg-amber-50'}`}>
                      <div className="text-sm text-slate-600">Favicon</div>
                      <div className={`font-semibold ${results.technical.favicon ? 'text-green-700' : 'text-amber-700'}`}>
                        {results.technical.favicon ? '✓ Found' : '✗ Missing'}
                      </div>
                    </div>
                  </div>
                  {/* Robots.txt and Sitemap status */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-lg ${
                      results.robotsTxt?.found ? 'bg-green-50' : 
                      results.robotsTxt?.found === false ? 'bg-amber-50' : 'bg-slate-50'
                    }`}>
                      <div className="text-sm text-slate-600">robots.txt</div>
                      <div className={`font-semibold ${
                        results.robotsTxt?.found ? 'text-green-700' : 
                        results.robotsTxt?.found === false ? 'text-amber-700' : 'text-slate-500'
                      }`}>
                        {results.robotsTxt?.found ? '✓ Found' : 
                         results.robotsTxt?.found === false ? '✗ Not found' : '— N/A'}
                      </div>
                    </div>
                    <div className={`p-3 rounded-lg ${
                      results.sitemap?.accessible ? 'bg-green-50' : 
                      results.sitemap?.accessible === false ? 'bg-amber-50' : 'bg-slate-50'
                    }`}>
                      <div className="text-sm text-slate-600">sitemap.xml</div>
                      <div className={`font-semibold ${
                        results.sitemap?.accessible ? 'text-green-700' : 
                        results.sitemap?.accessible === false ? 'text-amber-700' : 'text-slate-500'
                      }`}>
                        {results.sitemap?.accessible ? '✓ Found' : 
                         results.sitemap?.accessible === false ? '✗ Not found' : '— N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="text-sm text-slate-500 mb-1">Platform</div>
                    <div className="font-medium text-slate-800">
                      {results.platform.cms.length > 0 ? results.platform.cms.join(', ') : 'Unknown'}
                    </div>
                    <div className="text-xs text-slate-500">{results.platform.renderMethod}</div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Content Analysis */}
            <Section title="Content Analysis" icon={FileText} id="content">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <div className="text-3xl font-bold text-slate-800">{results.content.wordCount}</div>
                  <div className="text-sm text-slate-500">Words</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <div className="text-3xl font-bold text-slate-800">{results.content.headings.h1.length}</div>
                  <div className="text-sm text-slate-500">H1 Tags</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <div className={`text-3xl font-bold ${results.content.genericScore > 50 ? 'text-amber-600' : 'text-slate-600'}`}>
                    {results.content.genericScore}%
                  </div>
                  <div className="text-sm text-slate-500">Generic Phrasing</div>
                </div>
              </div>
              
              <div className="mb-4">
                <h4 className="font-semibold text-slate-700 mb-2">Heading Structure</h4>
                <div className="space-y-2 text-sm">
                  {results.content.headings.h1.length > 0 && (
                    <div className="p-2 bg-emerald-50 rounded">
                      <span className="font-semibold text-emerald-700">H1:</span>{' '}
                      {results.content.headings.h1.join(' | ')}
                    </div>
                  )}
                  {results.content.headings.h2.length > 0 && (
                    <div className="p-2 bg-slate-50 rounded">
                      <span className="font-semibold text-slate-700">H2 ({results.content.headings.h2.length}):</span>{' '}
                      {results.content.headings.h2.slice(0, 5).join(' | ')}
                      {results.content.headings.h2.length > 5 && '...'}
                    </div>
                  )}
                  {results.content.headings.h3.length > 0 && (
                    <div className="p-2 bg-slate-50 rounded">
                      <span className="font-semibold text-slate-700">H3 ({results.content.headings.h3.length}):</span>{' '}
                      {results.content.headings.h3.slice(0, 5).join(' | ')}
                      {results.content.headings.h3.length > 5 && '...'}
                    </div>
                  )}
                </div>
              </div>
              
              {results.content.genericPhrases.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-700 mb-2">Generic/Overused Phrases Detected</h4>
                  <p className="text-sm text-slate-500 mb-2">These phrases are commonly overused. Consider more original wording.</p>
                  <div className="flex flex-wrap gap-2">
                    {results.content.genericPhrases.slice(0, 10).map((phrase, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-sm">
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* Images & Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Section title="Images" icon={Image} id="images">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-slate-800">{results.images.total}</div>
                    <div className="text-sm text-slate-500">Total</div>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${results.images.withoutAlt > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <div className={`text-2xl font-bold ${results.images.withoutAlt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {results.images.withoutAlt}
                    </div>
                    <div className="text-sm text-slate-500">Missing Alt</div>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${results.images.withoutDimensions > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
                    <div className={`text-2xl font-bold ${results.images.withoutDimensions > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {results.images.withoutDimensions}
                    </div>
                    <div className="text-sm text-slate-500">No Dimensions</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{results.images.lazyLoaded}</div>
                    <div className="text-sm text-slate-500">Lazy Loaded</div>
                  </div>
                </div>
              </Section>

              <Section title="Links" icon={Link2} id="links">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-slate-800">{results.links.internal}</div>
                    <div className="text-sm text-slate-500">Internal</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-slate-800">{results.links.external}</div>
                    <div className="text-sm text-slate-500">External</div>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${results.links.genericAnchors > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
                    <div className={`text-2xl font-bold ${results.links.genericAnchors > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {results.links.genericAnchors}
                    </div>
                    <div className="text-sm text-slate-500">Generic Anchors</div>
                  </div>
                  <div className={`p-3 rounded-lg text-center ${results.links.broken > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <div className={`text-2xl font-bold ${results.links.broken > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {results.links.broken}
                    </div>
                    <div className="text-sm text-slate-500">Empty/Broken</div>
                  </div>
                </div>
              </Section>
            </div>

            {/* Schema & Social */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Section title="Schema.org" icon={Code} id="schema">
                {results.schema.count > 0 ? (
                  <div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {results.schema.types.map((type, i) => (
                        <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                          {type}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-slate-600">
                      Found {results.schema.count} schema(s), {results.schema.valid} valid
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500">No structured data found</p>
                )}
              </Section>

              <Section title="Social Tags" icon={Globe} id="social">
                <div className="space-y-2 text-sm">
                  <div className={`flex items-center gap-2 ${results.social.og.title ? 'text-green-700' : 'text-red-700'}`}>
                    {results.social.og.title ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    og:title {results.social.og.title && `- "${results.social.og.title.substring(0, 40)}..."`}
                  </div>
                  <div className={`flex items-center gap-2 ${results.social.og.description ? 'text-green-700' : 'text-red-700'}`}>
                    {results.social.og.description ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    og:description
                  </div>
                  <div className={`flex items-center gap-2 ${results.social.og.image ? 'text-green-700' : 'text-red-700'}`}>
                    {results.social.og.image ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    og:image
                  </div>
                  <div className={`flex items-center gap-2 ${results.social.twitter.card ? 'text-green-700' : 'text-amber-600'}`}>
                    {results.social.twitter.card ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    Twitter Card: {results.social.twitter.card || 'Not set'}
                  </div>
                </div>
              </Section>
            </div>

            {/* Trust Signals (E-E-A-T) */}
            <Section title="Trust Signals (E-E-A-T)" icon={Shield} id="trust">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`p-3 rounded-lg text-center ${results.trustSignals.hasAuthor ? 'bg-green-50' : 'bg-slate-50'}`}>
                  <div className={`text-2xl mb-1 ${results.trustSignals.hasAuthor ? 'text-green-600' : 'text-slate-400'}`}>
                    {results.trustSignals.hasAuthor ? '✓' : '—'}
                  </div>
                  <div className="text-sm text-slate-600">Author Info</div>
                </div>
                <div className={`p-3 rounded-lg text-center ${results.trustSignals.hasAboutPage ? 'bg-green-50' : 'bg-slate-50'}`}>
                  <div className={`text-2xl mb-1 ${results.trustSignals.hasAboutPage ? 'text-green-600' : 'text-slate-400'}`}>
                    {results.trustSignals.hasAboutPage ? '✓' : '—'}
                  </div>
                  <div className="text-sm text-slate-600">About Page</div>
                </div>
                <div className={`p-3 rounded-lg text-center ${results.trustSignals.hasContactPage ? 'bg-green-50' : 'bg-slate-50'}`}>
                  <div className={`text-2xl mb-1 ${results.trustSignals.hasContactPage ? 'text-green-600' : 'text-slate-400'}`}>
                    {results.trustSignals.hasContactPage ? '✓' : '—'}
                  </div>
                  <div className="text-sm text-slate-600">Contact Page</div>
                </div>
                <div className={`p-3 rounded-lg text-center ${results.trustSignals.socialLinksCount > 0 ? 'bg-green-50' : 'bg-slate-50'}`}>
                  <div className={`text-2xl font-bold mb-1 ${results.trustSignals.socialLinksCount > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                    {results.trustSignals.socialLinksCount || '—'}
                  </div>
                  <div className="text-sm text-slate-600">Social Links</div>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-3">
                E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) signals help establish credibility with both users and search engines.
              </p>
            </Section>

            {/* Hreflang */}
            {results.international.hreflangs.length > 0 && (
              <Section 
                title="Hreflang Tags" 
                icon={Globe} 
                id="hreflang"
                badge={
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {results.international.hreflangs.length}
                  </span>
                }
              >
                <div className="space-y-2">
                  {results.international.hreflangs.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded text-sm">
                      <span className="font-mono font-semibold text-slate-700 w-20">{h.hreflang}</span>
                      <span className="text-slate-600 truncate">{h.href}</span>
                    </div>
                  ))}
                </div>
                {!results.international.hasXDefault && (
                  <p className="mt-3 text-amber-600 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Missing x-default hreflang
                  </p>
                )}
              </Section>
            )}

            {/* Performance */}
            <Section title="Performance Hints" icon={Zap} id="performance">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-slate-800">{results.performance.totalScripts}</div>
                  <div className="text-sm text-slate-500">Scripts</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-slate-800">{results.performance.totalStylesheets}</div>
                  <div className="text-sm text-slate-500">Stylesheets</div>
                </div>
                <div className={`p-3 rounded-lg text-center ${results.performance.preconnects > 0 ? 'bg-green-50' : 'bg-slate-50'}`}>
                  <div className={`text-2xl font-bold ${results.performance.preconnects > 0 ? 'text-green-600' : 'text-slate-800'}`}>
                    {results.performance.preconnects}
                  </div>
                  <div className="text-sm text-slate-500">Preconnects</div>
                </div>
                <div className={`p-3 rounded-lg text-center ${results.performance.preloads > 0 ? 'bg-green-50' : 'bg-slate-50'}`}>
                  <div className={`text-2xl font-bold ${results.performance.preloads > 0 ? 'text-green-600' : 'text-slate-800'}`}>
                    {results.performance.preloads}
                  </div>
                  <div className="text-sm text-slate-500">Preloads</div>
                </div>
              </div>
              {results.performance.renderBlockingScripts > 2 && (
                <p className="mt-3 text-amber-600 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {results.performance.renderBlockingScripts} render-blocking scripts detected
                </p>
              )}
            </Section>

            {/* All Checks */}
            <Section 
              title="All Checks Performed" 
              icon={CheckCircle} 
              id="allchecks"
              badge={
                <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full text-sm font-medium">
                  {results.checksPerformed.length}
                </span>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {results.checksPerformed.map((check, i) => (
                  <div key={i} className="flex items-center gap-2 text-slate-600 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {check}
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>SEO Audit Tool Pro • Built for 10xSEO</p>
        </div>
      </div>
    </div>
  );
};

export default SEOAuditToolPro;
