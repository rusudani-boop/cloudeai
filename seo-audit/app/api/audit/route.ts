// app/api/audit/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { runAudit } from '@/lib/audit/runAudit';
import { fetchHtml, fetchRobotsTxt, checkSitemap, validateUrl } from '@/lib/fetch/fetchHtml';

// Rate limiting
const rateLimits = new Map<string, { count: number; ts: number }>();

function checkRate(ip: string): boolean {
  const now = Date.now();
  const r = rateLimits.get(ip);
  if (!r || now - r.ts > 60000) { rateLimits.set(ip, { count: 1, ts: now }); return true; }
  if (r.count >= 30) return false;
  r.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    if (!checkRate(ip)) {
      return NextResponse.json({ error: 'ლიმიტი ამოიწურა. დაელოდეთ 1 წუთი.' }, { status: 429 });
    }
    
    const { url, html: providedHtml } = await request.json();
    
    if (!url && !providedHtml) {
      return NextResponse.json({ error: 'URL ან HTML აუცილებელია' }, { status: 400 });
    }
    
    let html: string;
    let finalUrl = url || 'pasted-html';
    let fetchMethod: 'url' | 'html' = 'html';
    
    if (providedHtml) {
      html = providedHtml;
      const canonical = providedHtml.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
      const ogUrl = providedHtml.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
      finalUrl = canonical?.[1] || ogUrl?.[1] || url || 'pasted-html';
    } else {
      const v = validateUrl(url);
      if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });
      
      try {
        const result = await fetchHtml(url);
        html = result.html;
        finalUrl = result.finalUrl;
        fetchMethod = 'url';
        
        if (html.length < 1000 && html.toLowerCase().includes('cloudflare')) {
          return NextResponse.json({ error: 'საიტი დაცულია. გამოიყენეთ "HTML ჩასმა" რეჟიმი.', blocked: true }, { status: 403 });
        }
      } catch (e) {
        return NextResponse.json({ error: `URL ვერ ჩაიტვირთა: ${e instanceof Error ? e.message : 'შეცდომა'}` }, { status: 502 });
      }
    }
    
    const result = await runAudit(html, finalUrl);
    result.fetchMethod = fetchMethod;
    
    // Fetch robots.txt and sitemap
    if (fetchMethod === 'url') {
      try {
        const base = `${new URL(finalUrl).protocol}//${new URL(finalUrl).host}`;
        const [robots, sitemap] = await Promise.all([fetchRobotsTxt(base), checkSitemap(base)]);
        if (robots) {
          result.technical.robotsTxt = { found: true, content: robots, blocksAll: robots.includes('Disallow: /'), hasSitemap: robots.toLowerCase().includes('sitemap:') };
        }
        result.technical.sitemap = sitemap;
      } catch {}
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Audit]', error);
    return NextResponse.json({ error: 'აუდიტი ვერ შესრულდა' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', version: '1.0.0' });
}
