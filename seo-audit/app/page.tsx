'use client';

import React, { useState, useCallback } from 'react';

// Types matching the updated audit system
interface AuditIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  issueGe: string;
  location: string;
  fix: string;
  fixGe: string;
  current?: string;
  details?: string;
}

interface HreflangTag {
  hreflang: string;
  href: string;
}

interface SchemaItem {
  index: string;
  type: string;
  valid: boolean;
  issues: string[];
}

interface AuditResult {
  url: string;
  score: number;
  timestamp: string;
  fetchMethod: 'url' | 'html';
  summary: {
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    totalChecks: number;
    passedChecks: number;
  };
  technical: {
    title: { value: string; length: number; isOptimal: boolean };
    metaDesc: { value: string; length: number; isOptimal: boolean };
    canonical: { href: string | null; count: number; isCrossDomain: boolean };
    robots: { meta: string | null; hasNoindex: boolean; hasNofollow: boolean };
    robotsTxt: { found: boolean; content: string | null; blocksAll: boolean; hasSitemap: boolean };
    sitemap: { found: boolean; url: string | null };
    language: string | null;
    charset: string | null;
    viewport: { content: string | null; isMobileOptimized: boolean };
    favicon: boolean;
    appleTouchIcon: boolean;
  };
  international: {
    hreflangs: HreflangTag[];
    hasXDefault: boolean;
    hasSelfReference: boolean;
    issues: string[];
  };
  content: {
    headings: { h1: string[]; h2: string[]; h3: string[]; h4: string[]; h5: string[]; h6: string[] };
    wordCount: number;
    readingTime: number;
    titleH1Duplicate: boolean;
    duplicateParagraphs: number;
    aiScore: number;
    aiPhrases: string[];
  };
  links: {
    total: number;
    internal: number;
    external: number;
    broken: number;
    brokenList: { href: string; text: string }[];
    genericAnchors: number;
    genericAnchorsList: { text: string; href: string }[];
    nofollow: number;
    unsafeExternalCount: number;
  };
  images: {
    total: number;
    withoutAlt: number;
    withoutDimensions: number;
    lazyLoaded: number;
    lazyAboveFold: number;
    clickableWithoutAlt: number;
  };
  schema: {
    count: number;
    types: string[];
    valid: number;
    invalid: number;
    details: SchemaItem[];
    missingContext: number;
  };
  social: {
    og: { title: string | null; description: string | null; image: string | null; url: string | null; type: string | null };
    twitter: { card: string | null; title: string | null; description: string | null; image: string | null };
    isComplete: boolean;
  };
  accessibility: {
    buttonsWithoutLabel: number;
    inputsWithoutLabel: number;
    linksWithoutText: number;
    iframesWithoutTitle: number;
    skippedHeadings: string[];
    hasSkipLink: boolean;
    hasLangAttribute: boolean;
    clickableImagesWithoutAlt: number;
    positiveTabindex: number;
  };
  performance: {
    totalScripts: number;
    totalStylesheets: number;
    renderBlockingScripts: number;
    renderBlockingStyles: number;
    preloads: number;
    preloadsWithoutAs: number;
    preconnects: number;
    prefetches: number;
    dnsPrefetches: number;
    fontsWithoutDisplay: number;
  };
  security: {
    isHttps: boolean;
    mixedContentCount: number;
    mixedContentUrls: string[];
    protocolRelativeCount: number;
    unsafeExternalLinks: number;
  };
  platform: {
    cms: string[];
    frameworks: string[];
    renderMethod: string;
    isCSR: boolean;
  };
  trustSignals: {
    hasAboutPage: boolean;
    hasContactPage: boolean;
    hasPrivacyPage: boolean;
    hasAuthor: boolean;
    socialLinksCount: number;
    socialPlatforms: string[];
  };
  issues: AuditIssue[];
  passed: string[];
}

// Icons
const Icons = {
  Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Globe: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>,
  Code: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  Download: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Alert: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Check: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ChevronDown: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
  ChevronUp: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>,
  Loader: () => <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Link: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  Image: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Share: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
  Shield: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Zap: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Lock: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  Languages: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>,
  FileText: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Eye: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Brain: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
};

export default function SEOChecker() {
  const [url, setUrl] = useState('');
  const [htmlInput, setHtmlInput] = useState('');
  const [inputMode, setInputMode] = useState<'url' | 'html'>('url');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<AuditResult | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isDragging, setIsDragging] = useState(false);

  const handleAnalyze = async () => {
    setError('');
    setResults(null);
    setLoading(true);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputMode === 'url' ? { url } : { html: htmlInput, url }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'აუდიტი ვერ შესრულდა');

      setResults(data);
      setExpanded({ issues: true, passed: true, technical: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'შეცდომა მოხდა');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.type === 'text/html' || file.name.endsWith('.html'))) {
      const reader = new FileReader();
      reader.onload = (ev) => { setHtmlInput(ev.target?.result as string); setInputMode('html'); };
      reader.readAsText(file);
    }
  }, []);

  const exportData = (format: 'json' | 'csv') => {
    if (!results) return;
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `seo-audit-${new Date().toISOString().split('T')[0]}.json`; a.click();
    } else {
      const rows = [['კატეგორია', 'პრობლემა', 'სერიოზულობა', 'ადგილი', 'გამოსწორება']];
      results.issues.forEach(i => rows.push([i.category, i.issueGe, i.severity, i.location, i.fixGe]));
      const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `seo-audit-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    }
  };

  const getScoreBg = (s: number) => s >= 90 ? 'from-green-500 to-emerald-600' : s >= 70 ? 'from-yellow-500 to-amber-600' : s >= 50 ? 'from-orange-500 to-orange-600' : 'from-red-500 to-red-600';

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getSeverityLabel = (sev: string) => {
    switch (sev) {
      case 'critical': return 'კრიტიკული';
      case 'high': return 'მაღალი';
      case 'medium': return 'საშუალო';
      default: return 'დაბალი';
    }
  };

  const Section = ({ title, icon: Icon, id, children, badge }: { title: string; icon: React.FC; id: string; children: React.ReactNode; badge?: React.ReactNode }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
    <button onClick={() => setExpanded(s => ({ ...s, [id]: !s[id] }))} className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50">
    <div className="flex items-center gap-3"><Icon /><span className="font-semibold text-gray-800">{title}</span>{badge}</div>
    {expanded[id] ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
    </button>
    {expanded[id] && <div className="px-5 pb-5 border-t border-gray-100">{children}</div>}
    </div>
  );

  const CheckBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className={`flex items-center gap-1.5 text-sm ${ok ? 'text-green-700' : 'text-red-700'}`}>
    {ok ? <Icons.Check /> : <Icons.Alert />} {label}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    {/* Header */}
    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
    <div className="max-w-6xl mx-auto px-6 py-8">
    <h1 className="text-3xl font-bold">SEO აუდიტი</h1>
    <p className="text-emerald-100 mt-1">ვებგვერდის SEO ანალიზი • 50+ შემოწმება</p>
    </div>
    </div>

    <div className="max-w-6xl mx-auto px-6 py-8">
    {/* Input */}
    <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
    <div className="flex gap-3 mb-5">
    <button onClick={() => { setInputMode('url'); setResults(null); setError(''); }} className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 ${inputMode === 'url' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
    <Icons.Globe /> URL-ით
    </button>
    <button onClick={() => { setInputMode('html'); setResults(null); setError(''); }} className={`px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 ${inputMode === 'html' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
    <Icons.Code /> HTML ჩასმა
    </button>
    </div>

    {inputMode === 'url' ? (
      <div>
      <div className="flex gap-3">
      <div className="flex-1 relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Globe /></div>
      <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 outline-none" onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()} />
      </div>
      <button onClick={handleAnalyze} disabled={loading || !url} className="px-8 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2">
      {loading ? <Icons.Loader /> : <Icons.Search />} ანალიზი
      </button>
      </div>
      <p className="text-sm text-gray-500 mt-3">💡 თუ საიტი დაცულია Cloudflare-ით, გამოიყენეთ &quot;HTML ჩასმა&quot; რეჟიმი</p>
      </div>
    ) : (
      <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
      <div className="flex gap-3 mb-3">
      <div className="flex-1 relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Globe /></div>
      <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (არასავალდებულო)" className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 outline-none" />
      </div>
      </div>
      <textarea value={htmlInput} onChange={(e) => setHtmlInput(e.target.value)} placeholder={`ჩასვით HTML კოდი აქ...\n\nროგორ მივიღოთ HTML:\n1. გახსენით გვერდი ბრაუზერში\n2. დააჭირეთ Ctrl+U (Windows) ან Cmd+Option+U (Mac)\n3. აირჩიეთ ყველა (Ctrl+A) და დააკოპირეთ (Ctrl+C)\n4. ჩასვით აქ\n\n💡 ან გადმოიტანეთ HTML ფაილი აქ`} className={`w-full h-48 px-4 py-3 border-2 rounded-xl font-mono text-sm resize-none ${isDragging ? 'border-emerald-500 bg-emerald-50 border-dashed' : 'border-gray-200'}`} />
      <div className="flex justify-between items-center mt-4">
      <span className="text-sm text-gray-500">{htmlInput ? `${htmlInput.length.toLocaleString()} სიმბოლო` : ''}</span>
      <button onClick={handleAnalyze} disabled={loading || !htmlInput} className="px-8 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2">
      {loading ? <Icons.Loader /> : <Icons.Search />} ანალიზი
      </button>
      </div>
      </div>
    )}

    {error && (
      <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
      <span className="text-red-600"><Icons.Alert /></span>
      <span className="text-red-700">{error}</span>
      </div>
    )}
    </div>

    {/* Results */}
    {results && (
      <div className="space-y-6">
      {/* Score */}
      <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex flex-col md:flex-row items-center gap-6">
      <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${getScoreBg(results.score)} flex items-center justify-center shadow-lg`}>
      <div className="text-center">
      <div className="text-4xl font-bold text-white">{results.score}</div>
      <div className="text-white/80 text-sm">/ 100</div>
      </div>
      </div>
      <div className="flex-1 text-center md:text-left">
      <h2 className="text-xl font-bold text-gray-900 break-all">{results.url}</h2>
      <div className="flex flex-wrap gap-3 mt-3 justify-center md:justify-start">
      {results.summary.criticalIssues > 0 && <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">{results.summary.criticalIssues} კრიტიკული</span>}
      {results.summary.highIssues > 0 && <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">{results.summary.highIssues} მაღალი</span>}
      {results.summary.mediumIssues > 0 && <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">{results.summary.mediumIssues} საშუალო</span>}
      {results.summary.lowIssues > 0 && <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">{results.summary.lowIssues} დაბალი</span>}
      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">{results.summary.passedChecks} წარმატებული</span>
      </div>
      </div>
      <div className="flex gap-2">
      <button onClick={() => exportData('json')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-sm"><Icons.Download /> JSON</button>
      <button onClick={() => exportData('csv')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-sm"><Icons.Download /> CSV</button>
      </div>
      </div>
      </div>

      {/* Issues */}
      <Section title="ნაპოვნი პრობლემები" icon={Icons.Alert} id="issues" badge={<span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-sm">{results.issues.length}</span>}>
      <div className="space-y-3 mt-4">
      {results.issues.map((issue, i) => (
        <div key={i} className={`p-4 rounded-lg border ${getSeverityStyle(issue.severity)}`}>
        <div className="flex items-start justify-between gap-4">
        <div>
        <div className="font-medium">{issue.issueGe}</div>
        <div className="text-sm mt-1 opacity-80"><code className="bg-white/50 px-1 rounded">{issue.location}</code></div>
        {issue.current && <div className="text-xs mt-1 opacity-70 truncate max-w-md">მიმდინარე: {issue.current}</div>}
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded bg-white/50 whitespace-nowrap">{getSeverityLabel(issue.severity)}</span>
        </div>
        <div className="text-sm mt-2 opacity-90"><strong>გამოსწორება:</strong> {issue.fixGe}</div>
        </div>
      ))}
      </div>
      </Section>

      {/* Passed */}
      <Section title="წარმატებული შემოწმებები" icon={Icons.Check} id="passed" badge={<span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-sm">{results.passed.length}</span>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
      {results.passed.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg text-sm"><Icons.Check /> {p}</div>
      ))}
      </div>
      </Section>

      {/* Technical */}
      <Section title="ტექნიკური დეტალები" icon={Icons.Shield} id="technical">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div className="p-4 bg-gray-50 rounded-lg">
      <div className="text-sm text-gray-500 mb-1">სათაური (Title)</div>
      <div className="font-medium text-sm">{results.technical.title.value || '—'}</div>
      <div className="text-sm text-gray-500 mt-1">{results.technical.title.length} სიმბოლო {results.technical.title.isOptimal && <span className="text-green-600">✓</span>}</div>
      </div>
      <div className="p-4 bg-gray-50 rounded-lg">
      <div className="text-sm text-gray-500 mb-1">მეტა აღწერა</div>
      <div className="font-medium text-sm">{results.technical.metaDesc.value?.substring(0, 80) || '—'}{results.technical.metaDesc.value && results.technical.metaDesc.value.length > 80 ? '...' : ''}</div>
      <div className="text-sm text-gray-500 mt-1">{results.technical.metaDesc.length} სიმბოლო {results.technical.metaDesc.isOptimal && <span className="text-green-600">✓</span>}</div>
      </div>
      <div className="p-4 bg-gray-50 rounded-lg">
      <div className="text-sm text-gray-500 mb-1">H1 სათაური</div>
      <div className="font-medium text-sm">{results.content.headings.h1[0] || '—'}</div>
      <div className="text-sm text-gray-500 mt-1">{results.content.headings.h1.length} H1 {results.content.titleH1Duplicate && <span className="text-yellow-600">⚠ Title-თან იდენტური</span>}</div>
      </div>
      <div className="p-4 bg-gray-50 rounded-lg">
      <div className="text-sm text-gray-500 mb-1">სიტყვების რაოდენობა</div>
      <div className="font-medium">{results.content.wordCount.toLocaleString()}</div>
      <div className="text-sm text-gray-500 mt-1">~{results.content.readingTime} წთ კითხვა</div>
      </div>
      </div>
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
      <div className="text-sm font-medium text-gray-700 mb-3">ტექნიკური შემოწმებები</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <CheckBadge ok={!!results.technical.viewport.isMobileOptimized} label="Viewport" />
      <CheckBadge ok={!!results.technical.charset} label="Charset" />
      <CheckBadge ok={!!results.technical.language} label={`Lang: ${results.technical.language || '—'}`} />
      <CheckBadge ok={results.technical.favicon} label="Favicon" />
      <CheckBadge ok={results.security.isHttps} label="HTTPS" />
      <CheckBadge ok={!results.technical.robots.hasNoindex} label={results.technical.robots.hasNoindex ? 'NOINDEX!' : 'Indexable'} />
      <CheckBadge ok={!results.platform.isCSR} label={results.platform.isCSR ? 'CSR' : 'SSR/SSG'} />
      <CheckBadge ok={results.accessibility.hasSkipLink} label="Skip Link" />
      </div>
      </div>
      </Section>

      {/* Security */}
      <Section title="უსაფრთხოება" icon={Icons.Lock} id="security">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
      <div className={`text-center p-4 rounded-lg ${results.security.isHttps ? 'bg-green-50' : 'bg-red-50'}`}>
      <div className={`text-2xl font-bold ${results.security.isHttps ? 'text-green-700' : 'text-red-700'}`}>{results.security.isHttps ? '✓' : '✗'}</div>
      <div className="text-sm text-gray-600">HTTPS</div>
      </div>
      <div className={`text-center p-4 rounded-lg ${results.security.mixedContentCount === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
      <div className={`text-2xl font-bold ${results.security.mixedContentCount === 0 ? 'text-green-700' : 'text-red-700'}`}>{results.security.mixedContentCount}</div>
      <div className="text-sm text-gray-600">Mixed Content</div>
      </div>
      <div className={`text-center p-4 rounded-lg ${results.security.unsafeExternalLinks === 0 ? 'bg-green-50' : 'bg-yellow-50'}`}>
      <div className={`text-2xl font-bold ${results.security.unsafeExternalLinks === 0 ? 'text-green-700' : 'text-yellow-700'}`}>{results.security.unsafeExternalLinks}</div>
      <div className="text-sm text-gray-600">Unsafe Links</div>
      </div>
      <div className="text-center p-4 bg-gray-50 rounded-lg">
      <div className="text-2xl font-bold text-gray-700">{results.security.protocolRelativeCount}</div>
      <div className="text-sm text-gray-600">Protocol-relative</div>
      </div>
      </div>
      {results.security.mixedContentUrls.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg">
        <div className="text-sm font-medium text-red-800 mb-2">Mixed Content URLs:</div>
        <div className="text-xs text-red-700 space-y-1">
        {results.security.mixedContentUrls.slice(0, 5).map((u, i) => <div key={i} className="truncate">{u}</div>)}
        </div>
        </div>
      )}
      </Section>

      {/* International / Hreflang */}
      {results.international.hreflangs.length > 0 && (
        <Section title="Hreflang / საერთაშორისო" icon={Icons.Languages} id="international" badge={<span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-sm">{results.international.hreflangs.length} ენა</span>}>
        <div className="mt-4 space-y-2">
        {results.international.hreflangs.map((h, i) => (
          <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
          <span className="font-mono font-semibold text-gray-700 w-20">{h.hreflang}</span>
          <span className="text-gray-600 truncate flex-1">{h.href}</span>
          </div>
        ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
        <CheckBadge ok={results.international.hasXDefault} label="x-default" />
        <CheckBadge ok={results.international.hasSelfReference} label="Self-reference" />
        </div>
        {results.international.issues.length > 0 && (
          <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
          <div className="text-sm font-medium text-yellow-800 mb-1">პრობლემები:</div>
          <ul className="text-sm text-yellow-700 list-disc list-inside">
          {results.international.issues.map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
          </div>
        )}
        </Section>
      )}

      {/* Links */}
      <Section title="ბმულები" icon={Icons.Link} id="links">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
      <div className="text-center p-4 bg-blue-50 rounded-lg"><div className="text-2xl font-bold text-blue-700">{results.links.total}</div><div className="text-sm text-blue-600">სულ</div></div>
      <div className="text-center p-4 bg-green-50 rounded-lg"><div className="text-2xl font-bold text-green-700">{results.links.internal}</div><div className="text-sm text-green-600">შიდა</div></div>
      <div className="text-center p-4 bg-purple-50 rounded-lg"><div className="text-2xl font-bold text-purple-700">{results.links.external}</div><div className="text-sm text-purple-600">გარე</div></div>
      <div className={`text-center p-4 rounded-lg ${results.links.broken > 0 ? 'bg-red-50' : 'bg-gray-50'}`}><div className={`text-2xl font-bold ${results.links.broken > 0 ? 'text-red-700' : 'text-gray-700'}`}>{results.links.broken}</div><div className="text-sm text-gray-600">ცარიელი</div></div>
      <div className={`text-center p-4 rounded-lg ${results.links.genericAnchors > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}><div className={`text-2xl font-bold ${results.links.genericAnchors > 0 ? 'text-yellow-700' : 'text-gray-700'}`}>{results.links.genericAnchors}</div><div className="text-sm text-gray-600">ზოგადი</div></div>
      </div>
      </Section>

      {/* Images */}
      <Section title="სურათები" icon={Icons.Image} id="images">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
      <div className="text-center p-4 bg-gray-50 rounded-lg"><div className="text-2xl font-bold text-gray-700">{results.images.total}</div><div className="text-sm text-gray-600">სულ</div></div>
      <div className={`text-center p-4 rounded-lg ${results.images.withoutAlt > 0 ? 'bg-red-50' : 'bg-green-50'}`}><div className={`text-2xl font-bold ${results.images.withoutAlt > 0 ? 'text-red-700' : 'text-green-700'}`}>{results.images.withoutAlt}</div><div className="text-sm text-gray-600">alt-ის გარეშე</div></div>
      <div className={`text-center p-4 rounded-lg ${results.images.withoutDimensions > 0 ? 'bg-orange-50' : 'bg-green-50'}`}><div className={`text-2xl font-bold ${results.images.withoutDimensions > 0 ? 'text-orange-700' : 'text-green-700'}`}>{results.images.withoutDimensions}</div><div className="text-sm text-gray-600">ზომის გარეშე</div></div>
      <div className="text-center p-4 bg-green-50 rounded-lg"><div className="text-2xl font-bold text-green-700">{results.images.lazyLoaded}</div><div className="text-sm text-green-600">lazy loading</div></div>
      <div className={`text-center p-4 rounded-lg ${results.images.lazyAboveFold > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}><div className={`text-2xl font-bold ${results.images.lazyAboveFold > 0 ? 'text-yellow-700' : 'text-gray-700'}`}>{results.images.lazyAboveFold}</div><div className="text-sm text-gray-600">lazy above-fold</div></div>
      </div>
      </Section>

      {/* Schema */}
      {results.schema.count > 0 && (
        <Section title="Schema.org" icon={Icons.Code} id="schema" badge={<span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-sm">{results.schema.count}</span>}>
        <div className="mt-4">
        <div className="flex flex-wrap gap-2">
        {results.schema.types.map((t, i) => <span key={i} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">{t}</span>)}
        </div>
        <div className="text-sm text-gray-500 mt-3">{results.schema.valid} ვალიდური{results.schema.invalid > 0 && <span className="text-red-600">, {results.schema.invalid} არავალიდური</span>}{results.schema.missingContext > 0 && <span className="text-yellow-600">, {results.schema.missingContext} აკლია @context</span>}</div>
        {results.schema.details.some(d => d.issues.length > 0) && (
          <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
          <div className="text-sm font-medium text-yellow-800 mb-2">Schema პრობლემები:</div>
          {results.schema.details.filter(d => d.issues.length > 0).map((d, i) => (
            <div key={i} className="text-sm text-yellow-700"><strong>{d.type}:</strong> {d.issues.join(', ')}</div>
          ))}
          </div>
        )}
        </div>
        </Section>
      )}

      {/* Social */}
      <Section title="სოციალური ქსელები" icon={Icons.Share} id="social">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div className="p-4 bg-blue-50 rounded-lg">
      <div className="font-medium text-blue-800 mb-2">Open Graph</div>
      <div className="text-sm space-y-1">
      <CheckBadge ok={!!results.social.og.title} label={`og:title ${results.social.og.title ? '✓' : ''}`} />
      <CheckBadge ok={!!results.social.og.description} label="og:description" />
      <CheckBadge ok={!!results.social.og.image} label="og:image" />
      <CheckBadge ok={!!results.social.og.url} label="og:url" />
      </div>
      </div>
      <div className="p-4 bg-sky-50 rounded-lg">
      <div className="font-medium text-sky-800 mb-2">Twitter Card</div>
      <div className="text-sm space-y-1">
      <CheckBadge ok={!!results.social.twitter.card} label={`card: ${results.social.twitter.card || '—'}`} />
      <CheckBadge ok={!!results.social.twitter.image} label="image" />
      </div>
      </div>
      </div>
      </Section>

      {/* Platform */}
      <Section title="პლატფორმა" icon={Icons.Zap} id="platform">
      <div className="mt-4 space-y-3">
      {results.platform.cms.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-500">CMS:</span>
        {results.platform.cms.map((c, i) => <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">{c}</span>)}
        </div>
      )}
      {results.platform.frameworks.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-500">Framework:</span>
        {results.platform.frameworks.map((f, i) => <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">{f}</span>)}
        </div>
      )}
      <div className="flex items-center gap-2">
      <span className="text-gray-500">რენდერი:</span>
      <span className={`px-2 py-1 rounded text-sm ${results.platform.isCSR ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{results.platform.renderMethod}</span>
      </div>
      {results.trustSignals.socialPlatforms.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-500">სოც. ქსელები:</span>
        {results.trustSignals.socialPlatforms.map((s, i) => <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">{s}</span>)}
        </div>
      )}
      </div>
      </Section>

      {/* AI Content */}
      {results.content.aiScore > 20 && (
        <Section title="AI კონტენტის ანალიზი" icon={Icons.Brain} id="ai">
        <div className="mt-4">
        <div className="flex items-center gap-4">
        <div className="text-3xl font-bold text-purple-700">{results.content.aiScore}%</div>
        <div className="flex-1">
        <div className="h-2 bg-purple-200 rounded-full">
        <div className="h-2 bg-purple-600 rounded-full" style={{ width: `${results.content.aiScore}%` }} />
        </div>
        </div>
        </div>
        {results.content.aiPhrases.length > 0 && (
          <div className="mt-3 text-sm text-purple-700">
          ნაპოვნი ფრაზები: {results.content.aiPhrases.slice(0, 5).join(', ')}{results.content.aiPhrases.length > 5 && ` +${results.content.aiPhrases.length - 5}`}
          </div>
        )}
        </div>
        </Section>
      )}

      {/* Trust Signals */}
      <Section title="სანდოობა (E-E-A-T)" icon={Icons.Users} id="trust">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
      <div className={`p-3 rounded-lg text-center ${results.trustSignals.hasAboutPage ? 'bg-green-50' : 'bg-gray-50'}`}>
      <div className={`text-2xl mb-1 ${results.trustSignals.hasAboutPage ? 'text-green-600' : 'text-gray-400'}`}>{results.trustSignals.hasAboutPage ? '✓' : '—'}</div>
      <div className="text-sm text-gray-600">ჩვენს შესახებ</div>
      </div>
      <div className={`p-3 rounded-lg text-center ${results.trustSignals.hasContactPage ? 'bg-green-50' : 'bg-gray-50'}`}>
      <div className={`text-2xl mb-1 ${results.trustSignals.hasContactPage ? 'text-green-600' : 'text-gray-400'}`}>{results.trustSignals.hasContactPage ? '✓' : '—'}</div>
      <div className="text-sm text-gray-600">კონტაქტი</div>
      </div>
      <div className={`p-3 rounded-lg text-center ${results.trustSignals.hasPrivacyPage ? 'bg-green-50' : 'bg-gray-50'}`}>
      <div className={`text-2xl mb-1 ${results.trustSignals.hasPrivacyPage ? 'text-green-600' : 'text-gray-400'}`}>{results.trustSignals.hasPrivacyPage ? '✓' : '—'}</div>
      <div className="text-sm text-gray-600">კონფიდენც.</div>
      </div>
      <div className={`p-3 rounded-lg text-center ${results.trustSignals.hasAuthor ? 'bg-green-50' : 'bg-gray-50'}`}>
      <div className={`text-2xl mb-1 ${results.trustSignals.hasAuthor ? 'text-green-600' : 'text-gray-400'}`}>{results.trustSignals.hasAuthor ? '✓' : '—'}</div>
      <div className="text-sm text-gray-600">ავტორი</div>
      </div>
      <div className={`p-3 rounded-lg text-center ${results.trustSignals.socialLinksCount > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
      <div className={`text-2xl font-bold mb-1 ${results.trustSignals.socialLinksCount > 0 ? 'text-green-600' : 'text-gray-400'}`}>{results.trustSignals.socialLinksCount || '—'}</div>
      <div className="text-sm text-gray-600">სოც. ბმულები</div>
      </div>
      </div>
      </Section>
      </div>
    )}
    </div>

    {/* Footer */}
    <div className="text-center py-8 text-gray-400 text-sm">
    SEO აუდიტი • 10xSEO • {new Date().getFullYear()}
    </div>
    </div>
  );
}
