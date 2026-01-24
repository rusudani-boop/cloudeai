// lib/fetch/fetchHtml.ts

import https from 'https';
import http from 'http';
import { URL } from 'url';
import type { FetchResult } from '../audit/types';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,ka;q=0.8',
  'Connection': 'close',
};

export async function fetchHtml(url: string, timeout = 15000): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const doFetch = (targetUrl: string, redirects = 0): void => {
      if (redirects > 5) { reject(new Error('ძალიან ბევრი გადამისამართება')); return; }
      
      let parsed: URL;
      try { parsed = new URL(targetUrl); } 
      catch { reject(new Error('არასწორი URL')); return; }
      
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;
      
      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        timeout,
        headers: { ...HEADERS, Host: parsed.hostname },
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doFetch(new URL(res.headers.location, targetUrl).href, redirects + 1);
          return;
        }
        
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ html: data, status: res.statusCode || 0, finalUrl: targetUrl }));
      });
      
      req.on('error', err => reject(new Error(`შეცდომა: ${err.message}`)));
      req.on('timeout', () => { req.destroy(); reject(new Error('დრო ამოიწურა')); });
      req.end();
    };
    
    doFetch(url);
  });
}

export function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const p = new URL(url);
    if (!['http:', 'https:'].includes(p.protocol)) return { valid: false, error: 'URL უნდა იყოს http ან https' };
    if (['localhost', '127.0.0.1'].includes(p.hostname)) return { valid: false, error: 'ლოკალური URL-ები დაბლოკილია' };
    return { valid: true };
  } catch {
    return { valid: false, error: 'არასწორი URL ფორმატი' };
  }
}

export async function fetchRobotsTxt(baseUrl: string): Promise<string | null> {
  try {
    const result = await fetchHtml(new URL('/robots.txt', baseUrl).href, 5000);
    if (result.status === 200 && !result.html.includes('<html')) return result.html;
    return null;
  } catch { return null; }
}

export async function checkSitemap(baseUrl: string): Promise<{ found: boolean; url: string | null }> {
  try {
    const url = new URL('/sitemap.xml', baseUrl).href;
    const result = await fetchHtml(url, 5000);
    const found = result.status === 200 && (result.html.includes('<?xml') || result.html.includes('<urlset'));
    return { found, url: found ? url : null };
  } catch { return { found: false, url: null }; }
}

export async function checkLlmsTxt(baseUrl: string): Promise<{ found: boolean; content: string | null }> {
  // Try multiple common llms.txt locations
  const paths = ['/llms.txt', '/llms-full.txt', '/.well-known/llms.txt'];

  for (const path of paths) {
    try {
      const url = new URL(path, baseUrl).href;
      const result = await fetchHtml(url, 8000); // Increased timeout

      const content = result.html.trim();
      const lowerContent = content.toLowerCase();

      // Skip if clearly an HTML page
      if (lowerContent.startsWith('<!doctype') || lowerContent.startsWith('<html')) {
        continue;
      }

      // Check for llms.txt indicators
      const hasLlmsTxtIndicators =
        content.startsWith('#') || // Starts with comment
        lowerContent.includes('# llms') ||
        lowerContent.includes('# name:') ||
        lowerContent.includes('# description:') ||
        lowerContent.includes('llm') ||
        lowerContent.includes('language model') ||
        lowerContent.includes('ai ') ||
        (content.includes('http') && !content.includes('<a ')) || // Contains URLs but not HTML links
        /^[#\w\s\-:.,\/@]+$/m.test(content.substring(0, 200)); // Plain text format

      // Valid if: status 200, has content, and either has llms indicators OR is plain text (no HTML tags)
      const isPlainText = !lowerContent.includes('<head>') && !lowerContent.includes('<body>') && !lowerContent.includes('</div>');

      if (result.status === 200 && content.length > 10 && (hasLlmsTxtIndicators || isPlainText)) {
        return { found: true, content: content.substring(0, 500) };
      }
    } catch {
      // Try next path
    }
  }

  return { found: false, content: null };
}

// Check if a URL returns a redirect (301, 302, 307, 308)
export async function checkRedirect(url: string, timeout = 3000): Promise<{ isRedirect: boolean; status: number; location: string | null }> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;

      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'HEAD',
        timeout,
        headers: { ...HEADERS, Host: parsed.hostname },
      }, (res) => {
        const status = res.statusCode || 0;
        const isRedirect = status >= 300 && status < 400;
        resolve({ isRedirect, status, location: res.headers.location || null });
      });

      req.on('error', () => resolve({ isRedirect: false, status: 0, location: null }));
      req.on('timeout', () => { req.destroy(); resolve({ isRedirect: false, status: 0, location: null }); });
      req.end();
    } catch {
      resolve({ isRedirect: false, status: 0, location: null });
    }
  });
}

// Check multiple links for redirects (limited to first N links for performance)
export async function checkLinksForRedirects(links: string[], limit = 10): Promise<{ href: string; status: number; location: string }[]> {
  const redirectLinks: { href: string; status: number; location: string }[] = [];
  const linksToCheck = links.slice(0, limit);

  const results = await Promise.all(linksToCheck.map(async (href) => {
    const result = await checkRedirect(href);
    if (result.isRedirect && result.location) {
      return { href, status: result.status, location: result.location };
    }
    return null;
  }));

  results.forEach((r) => { if (r) redirectLinks.push(r); });
  return redirectLinks;
}
