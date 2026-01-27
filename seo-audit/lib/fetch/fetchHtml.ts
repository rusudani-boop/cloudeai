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

    const found =
      res.status === 200 &&
      (res.body?.includes('<urlset') ||
        res.body?.includes('<?xml'));

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
