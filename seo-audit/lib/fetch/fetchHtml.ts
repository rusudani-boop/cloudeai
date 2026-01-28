import { URL } from 'url';
import type { FetchResult } from '../audit/types';
import { requestUrl } from './request';

// --------------------
// Core Fetch
// --------------------

export async function fetchHtml(
  url: string,
  timeout = 15000
): Promise<FetchResult> {
  const result = await requestUrl({
    url,
    timeout,
    method: 'GET',
    readBody: true,
  });

  return {
    html: result.body || '',
    status: result.status,
    finalUrl: result.finalUrl,
  };
}

// --------------------
// URL Validation
// --------------------

export function validateUrl(
  url: string
): { valid: boolean; error?: string } {
  try {
    const p = new URL(url);
    if (!['http:', 'https:'].includes(p.protocol)) {
      return { valid: false, error: 'URL უნდა იყოს http ან https' };
    }
    if (
      ['localhost', '127.0.0.1', '::1'].includes(p.hostname)
    ) {
      return { valid: false, error: 'ლოკალური URL-ები დაბლოკილია' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'არასწორი URL ფორმატი' };
  }
}

// --------------------
// Robots / Sitemap
// --------------------

export async function fetchRobotsTxt(
  baseUrl: string
): Promise<string | null> {
  try {
    const url = new URL('/robots.txt', baseUrl).href;
    const res = await requestUrl({
      url,
      timeout: 5000,
    });

    const ct = res.headers['content-type'] || '';
    if (
      res.status === 200 &&
      !ct.toString().includes('html')
    ) {
      return res.body || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function checkSitemap(
  baseUrl: string
): Promise<{ found: boolean; url: string | null }> {
  try {
    const url = new URL('/sitemap.xml', baseUrl).href;
    const res = await requestUrl({ url, timeout: 5000 });

    const found = Boolean(
      res.status === 200 &&
      (res.body?.includes('<urlset') ||
        res.body?.includes('<?xml') ||
        res.body?.includes('<sitemapindex'))
    );

    return { found, url: found ? url : null };
  } catch {
    return { found: false, url: null };
  }
}

// --------------------
// Redirect Check
// --------------------

export async function checkRedirect(
  url: string,
  timeout = 3000
): Promise<{
  isRedirect: boolean;
  status: number;
  location: string | null;
}> {
  try {
    const res = await requestUrl({
      url,
      method: 'HEAD',
      timeout,
      followRedirects: false,
      readBody: false,
    });

    return {
      isRedirect: res.status >= 300 && res.status < 400,
      status: res.status,
      location: res.headers.location || null,
    };
  } catch {
    return { isRedirect: false, status: 0, location: null };
  }
}

// --------------------
// LLMs.txt Check
// --------------------

export async function checkLlmsTxt(
  baseUrl: string
): Promise<boolean> {
  try {
    const url = new URL('/llms.txt', baseUrl).href;
    const res = await requestUrl({ url, timeout: 5000 });
    return res.status === 200 && !!res.body && res.body.length > 10;
  } catch {
    return false;
  }
}

// --------------------
// URL in Sitemap Check
// --------------------

export async function checkUrlInSitemap(
  baseUrl: string,
  targetUrl: string
): Promise<{ found: boolean; inSitemap: boolean }> {
  try {
    const sitemapUrl = new URL('/sitemap.xml', baseUrl).href;
    const res = await requestUrl({ url: sitemapUrl, timeout: 10000 });

    if (res.status !== 200 || !res.body) {
      return { found: false, inSitemap: false };
    }

    const normalizedTarget = targetUrl.toLowerCase().replace(/\/$/, '');
    const inSitemap = res.body.toLowerCase().includes(normalizedTarget);

    return { found: true, inSitemap };
  } catch {
    return { found: false, inSitemap: false };
  }
}

// --------------------
// Redirect Checking for Multiple Links
// --------------------

export async function checkLinksForRedirects(
  links: { href: string; text: string }[],
  concurrency = 5
): Promise<{ href: string; text: string; status: number; location: string }[]> {
  const results: { href: string; text: string; status: number; location: string }[] = [];

  for (let i = 0; i < links.length; i += concurrency) {
    const batch = links.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (link) => {
        try {
          const res = await requestUrl({
            url: link.href,
            method: 'HEAD',
            timeout: 5000,
            followRedirects: false,
            readBody: false,
          });

          if (res.status >= 300 && res.status < 400) {
            return {
              href: link.href,
              text: link.text,
              status: res.status,
              location: res.headers.location || '',
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    );

    results.push(...batchResults.filter((r): r is NonNullable<typeof r> => r !== null));
  }

  return results;
}

// --------------------
// External Link Status Check
// --------------------

export async function checkExternalLinks(
  links: { href: string; text: string }[],
  concurrency = 3
): Promise<{ href: string; text: string; status: number; error?: string }[]> {
  const results: { href: string; text: string; status: number; error?: string }[] = [];

  for (let i = 0; i < links.length; i += concurrency) {
    const batch = links.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (link) => {
        try {
          const res = await requestUrl({
            url: link.href,
            method: 'HEAD',
            timeout: 8000,
            readBody: false,
          });

          if (res.status >= 400) {
            return {
              href: link.href,
              text: link.text,
              status: res.status,
            };
          }
          return null;
        } catch (e) {
          return {
            href: link.href,
            text: link.text,
            status: 0,
            error: e instanceof Error ? e.message : 'Connection error',
          };
        }
      })
    );

    results.push(...batchResults.filter((r): r is NonNullable<typeof r> => r !== null));
  }

  return results;
}

// --------------------
// Security Headers Check
// --------------------

export async function checkSecurityHeaders(
  url: string
): Promise<{
  headers: Record<string, string | null>;
  score: number;
  issues: string[];
}> {
  const securityHeaders = [
    'content-security-policy',
    'x-frame-options',
    'x-content-type-options',
    'strict-transport-security',
    'referrer-policy',
    'permissions-policy',
    'x-xss-protection',
  ];

  try {
    const res = await requestUrl({
      url,
      method: 'HEAD',
      timeout: 5000,
      readBody: false,
    });

    const foundHeaders: Record<string, string | null> = {};
    const issues: string[] = [];
    let score = 100;

    for (const header of securityHeaders) {
      const rawValue = res.headers[header];
      const value = Array.isArray(rawValue) ? rawValue[0] : rawValue || null;
      foundHeaders[header] = value;

      if (!value) {
        issues.push(`Missing ${header}`);
        score -= 14;
      }
    }

    return { headers: foundHeaders, score: Math.max(0, score), issues };
  } catch {
    return { headers: {}, score: 0, issues: ['Could not check security headers'] };
  }
}

// --------------------
// Image Size Check
// --------------------

export async function checkImageSize(
  images: { src: string; alt: string }[],
  concurrency = 3
): Promise<{
  checked: number;
  largeCount: number;
  oldFormatCount: number;
  largeList: { src: string; size: string; type: string | null }[];
  oldFormatList: { src: string; type: string | null }[];
}> {
  const largeList: { src: string; size: string; type: string | null }[] = [];
  const oldFormatList: { src: string; type: string | null }[] = [];
  let checked = 0;

  const LARGE_SIZE_THRESHOLD = 500 * 1024; // 500KB
  const oldFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp'];

  for (let i = 0; i < images.length; i += concurrency) {
    const batch = images.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (img) => {
        try {
          const res = await requestUrl({
            url: img.src,
            method: 'HEAD',
            timeout: 5000,
            readBody: false,
          });

          if (res.status === 200) {
            checked++;
            const contentLength = parseInt(res.headers['content-length'] || '0', 10);
            const contentType = res.headers['content-type'] || null;

            if (contentLength > LARGE_SIZE_THRESHOLD) {
              const sizeKB = Math.round(contentLength / 1024);
              largeList.push({
                src: img.src.substring(0, 100),
                size: `${sizeKB}KB`,
                type: contentType,
              });
            }

            if (contentType && oldFormats.some(f => contentType.includes(f))) {
              oldFormatList.push({
                src: img.src.substring(0, 100),
                type: contentType,
              });
            }
          }
        } catch {
          // Ignore errors
        }
      })
    );
  }

  return {
    checked,
    largeCount: largeList.length,
    oldFormatCount: oldFormatList.length,
    largeList: largeList.slice(0, 10),
    oldFormatList: oldFormatList.slice(0, 10),
  };
}

// --------------------
// SSL Certificate
// --------------------

export async function checkSSLCertificate(
  url: string
): Promise<{
  valid: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  error?: string;
}> {
  try {
    const res = await requestUrl({
      url,
      method: 'HEAD',
      timeout: 5000,
      readBody: false,
    });

    const socket = res.socket;
    if (!socket?.getPeerCertificate) {
      return { valid: false, error: 'No certificate' };
    }

    const cert = socket.getPeerCertificate();
    if (!cert?.valid_to) {
      return { valid: false, error: 'Invalid certificate' };
    }

    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);
    const now = new Date();

    const daysUntilExpiry = Math.floor(
      (validTo.getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return {
      valid:
        socket.authorized === true &&
        now >= validFrom &&
        now <= validTo,
      issuer:
        cert.issuer?.O ||
        cert.issuer?.CN ||
        'Unknown',
      validFrom: validFrom
        .toISOString()
        .split('T')[0],
      validTo: validTo.toISOString().split('T')[0],
      daysUntilExpiry,
    };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Error',
    };
  }
}
