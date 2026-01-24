// app/api/audit/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { runAudit } from '@/lib/audit/runAudit';
import { fetchHtml, fetchRobotsTxt, checkSitemap, checkLlmsTxt, validateUrl, checkLinksForRedirects } from '@/lib/fetch/fetchHtml';

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
    
    // Fetch robots.txt, sitemap, llms.txt and check links for redirects
    if (fetchMethod === 'url') {
      try {
        const base = `${new URL(finalUrl).protocol}//${new URL(finalUrl).host}`;

        // Parallel fetch of robots, sitemap, llms.txt
        const [robots, sitemap, llmsTxt] = await Promise.all([
          fetchRobotsTxt(base),
          checkSitemap(base),
          checkLlmsTxt(base)
        ]);

        if (robots) {
          result.technical.robotsTxt = { found: true, content: robots, blocksAll: robots.includes('Disallow: /'), hasSitemap: robots.toLowerCase().includes('sitemap:') };
        }
        result.technical.sitemap = sitemap;
        result.technical.llmsTxt = { found: llmsTxt.found, mentioned: result.technical.llmsTxt?.mentioned || false };

        // Check internal links for redirects (limit to 10 for performance)
        if (result.links.internalUrls && result.links.internalUrls.length > 0) {
          const linksToCheck = result.links.internalUrls.map((l: { href: string }) => l.href);
          const redirectResults = await checkLinksForRedirects(linksToCheck, 10);

          if (redirectResults.length > 0) {
            result.links.redirectLinks = redirectResults.length;
            result.links.redirectList = redirectResults.map((r) => {
              const linkInfo = result.links.internalUrls.find((l: { href: string }) => l.href === r.href);
              return { href: r.href, text: linkInfo?.text || '', status: r.status, location: r.location };
            });

            // Add redirect issue to the issues list
            result.issues.push({
              id: 'redirect-links',
              severity: 'medium' as const,
              category: 'ბმულები',
              issue: `${redirectResults.length} link(s) pointing to redirects (301/302)`,
              issueGe: `${redirectResults.length} ბმული მიმართავს გადამისამართებაზე (301/302)`,
              location: '<a href>',
              fix: 'Update links to point directly to final URLs',
              fixGe: 'განაახლეთ ბმულები საბოლოო URL-ებზე',
              details: `საშუალო პრიორიტეტი. გადამისამართებები ანელებს გვერდის ჩატვირთვას და კარგავს PageRank-ს. ნაპოვნი: ${redirectResults.slice(0, 3).map(r => `${r.href} → ${r.status}`).join('; ')}`
            });
          }
        }
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
