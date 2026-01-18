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
