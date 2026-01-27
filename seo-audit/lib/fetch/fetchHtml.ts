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

      // Reject HTML or HTML-like responses (Cloudflare, WAF, error pages)
      const isHtml = /<\/?[a-z][\s\S]*>/i.test(content);
      if (isHtml) {
        continue;
      }

      // Require llms.txt–specific structure (not vague keywords)
      const hasLlmsStructure =
        /^#\s*llms?/im.test(content) ||
        /^name:\s*/im.test(content) ||
        /^description:\s*/im.test(content) ||
        /^policies:\s*/im.test(content) ||
        /^allow:\s*/im.test(content);

      // Final validation
      if (
        result.status === 200 &&
        content.length > 20 &&
        hasLlmsStructure
      ) {
        return { found: true, content: content.substring(0, 500) };
      }
    } catch {
      continue;
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

// Check external links for 404 errors (HEAD request)
export async function checkExternalLinks(links: string[], limit = 10): Promise<{ href: string; status: number; error?: string }[]> {
  const brokenLinks: { href: string; status: number; error?: string }[] = [];
  const linksToCheck = links.slice(0, limit);

  const results = await Promise.all(linksToCheck.map(async (href) => {
    try {
      const parsed = new URL(href);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;

      return new Promise<{ href: string; status: number; error?: string } | null>((resolve) => {
        const req = lib.request({
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'HEAD',
          timeout: 5000,
          headers: { ...HEADERS, Host: parsed.hostname },
        }, (res) => {
          const status = res.statusCode || 0;
          if (status >= 400) {
            resolve({ href, status });
          } else {
            resolve(null);
          }
        });

        req.on('error', (err) => resolve({ href, status: 0, error: err.message }));
        req.on('timeout', () => { req.destroy(); resolve({ href, status: 0, error: 'timeout' }); });
        req.end();
      });
    } catch {
      return { href, status: 0, error: 'invalid URL' };
    }
  }));

  results.forEach((r) => { if (r) brokenLinks.push(r); });
  return brokenLinks;
}

// Check SSL certificate info
export async function checkSSLCertificate(url: string): Promise<{
  valid: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        resolve({ valid: false, error: 'Not HTTPS' });
        return;
      }

      const req = https.request({
        hostname: parsed.hostname,
        port: 443,
        method: 'HEAD',
        timeout: 5000,
      }, (res) => {
        const socket = res.socket as any;
        if (socket && socket.getPeerCertificate) {
          const cert = socket.getPeerCertificate();
          if (cert && cert.valid_to) {
            const validTo = new Date(cert.valid_to);
            const validFrom = new Date(cert.valid_from);
            const now = new Date();
            const daysUntilExpiry = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            resolve({
              valid: daysUntilExpiry > 0,
              issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
              validFrom: validFrom.toISOString().split('T')[0],
              validTo: validTo.toISOString().split('T')[0],
              daysUntilExpiry
            });
          } else {
            resolve({ valid: true }); // Certificate exists but couldn't get details
          }
        } else {
          resolve({ valid: true });
        }
      });

      req.on('error', (err) => resolve({ valid: false, error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ valid: false, error: 'timeout' }); });
      req.end();
    } catch (e) {
      resolve({ valid: false, error: e instanceof Error ? e.message : 'Unknown error' });
    }
  });
}

// Check security headers
export async function checkSecurityHeaders(url: string): Promise<{
  headers: Record<string, string | null>;
  score: number;
  issues: string[];
}> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;

      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname,
        method: 'HEAD',
        timeout: 5000,
        headers: { ...HEADERS, Host: parsed.hostname },
      }, (res) => {
        const h = res.headers;
        const issues: string[] = [];
        let score = 100;

        const headers = {
          'strict-transport-security': h['strict-transport-security'] as string || null,
          'content-security-policy': h['content-security-policy'] as string || null,
          'x-frame-options': h['x-frame-options'] as string || null,
          'x-content-type-options': h['x-content-type-options'] as string || null,
          'x-xss-protection': h['x-xss-protection'] as string || null,
          'referrer-policy': h['referrer-policy'] as string || null,
          'permissions-policy': h['permissions-policy'] as string || null,
        };

        // Check and score each header
        if (!headers['strict-transport-security'] && isHttps) {
          issues.push('Missing Strict-Transport-Security (HSTS)');
          score -= 15;
        }
        if (!headers['content-security-policy']) {
          issues.push('Missing Content-Security-Policy');
          score -= 15;
        }
        if (!headers['x-frame-options']) {
          issues.push('Missing X-Frame-Options (clickjacking protection)');
          score -= 10;
        }
        if (!headers['x-content-type-options']) {
          issues.push('Missing X-Content-Type-Options');
          score -= 10;
        }
        if (!headers['referrer-policy']) {
          issues.push('Missing Referrer-Policy');
          score -= 5;
        }

        resolve({ headers, score: Math.max(0, score), issues });
      });

      req.on('error', () => resolve({ headers: {}, score: 0, issues: ['Could not check headers'] }));
      req.on('timeout', () => { req.destroy(); resolve({ headers: {}, score: 0, issues: ['Timeout'] }); });
      req.end();
    } catch {
      resolve({ headers: {}, score: 0, issues: ['Invalid URL'] });
    }
  });
}

// Check if URL is in sitemap
export async function checkUrlInSitemap(sitemapUrl: string, pageUrl: string): Promise<{ found: boolean; urlCount: number }> {
  try {
    const result = await fetchHtml(sitemapUrl, 10000);
    if (result.status !== 200) return { found: false, urlCount: 0 };

    const content = result.html;
    const normalizedPageUrl = pageUrl.toLowerCase().replace(/\/$/, '');

    // Count URLs in sitemap
    const urlMatches = content.match(/<loc>[^<]+<\/loc>/gi) || [];
    const urlCount = urlMatches.length;

    // Check if our page URL is in the sitemap
    const found = urlMatches.some(match => {
      const url = match.replace(/<\/?loc>/gi, '').toLowerCase().replace(/\/$/, '');
      return url === normalizedPageUrl;
    });

    return { found, urlCount };
  } catch {
    return { found: false, urlCount: 0 };
  }
}

// Check image size via HEAD request
export async function checkImageSize(imageUrl: string): Promise<{ size: number; type: string | null } | null> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(imageUrl);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;

      const req = lib.request({
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'HEAD',
        timeout: 3000,
        headers: { ...HEADERS, Host: parsed.hostname },
      }, (res) => {
        const size = parseInt(res.headers['content-length'] || '0', 10);
        const type = res.headers['content-type'] || null;
        resolve({ size, type });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    } catch {
      resolve(null);
    }
  });
}
