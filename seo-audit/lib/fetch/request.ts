import http from 'http';
import https from 'https';
import { URL } from 'url';
import type { IncomingHttpHeaders } from 'http';

export interface RequestOptions {
  url: string;
  method?: 'GET' | 'HEAD';
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  readBody?: boolean;
  maxBodySize?: number;
}

export interface RequestResult {
  status: number;
  headers: IncomingHttpHeaders;
  body?: string;
  finalUrl: string;
  socket?: any;
}

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'close',
};

export async function requestUrl(
  options: RequestOptions,
  redirectCount = 0
): Promise<RequestResult> {
  const {
    url,
    method = 'GET',
    timeout = 15000,
    followRedirects = true,
    maxRedirects = 5,
    readBody = true,
    maxBodySize = 2 * 1024 * 1024, // 2MB
  } = options;

  if (redirectCount > maxRedirects) {
    throw new Error('Too many redirects');
  }

  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    let finished = false;

    const done = (err?: Error, result?: RequestResult) => {
      if (finished) return;
      finished = true;
      err ? reject(err) : resolve(result!);
    };

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers: { ...DEFAULT_HEADERS, Host: parsed.hostname },
      },
      (res) => {
        const status = res.statusCode || 0;

        // Handle redirects
        if (
          followRedirects &&
          status >= 300 &&
          status < 400 &&
          res.headers.location
        ) {
          res.resume();
          const nextUrl = new URL(res.headers.location, url).href;
          done(
            undefined,
            undefined as any
          );
          requestUrl(
            { ...options, url: nextUrl },
            redirectCount + 1
          ).then(resolve, reject);
          return;
        }

        if (!readBody || method === 'HEAD') {
          res.resume();
          done(undefined, {
            status,
            headers: res.headers,
            finalUrl: url,
            socket: res.socket,
          });
          return;
        }

        let body = '';
        let size = 0;

        res.setEncoding('utf8');

        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxBodySize) {
            req.destroy();
            done(new Error('Response body too large'));
            return;
          }
          body += chunk;
        });

        res.on('end', () => {
          done(undefined, {
            status,
            headers: res.headers,
            body,
            finalUrl: url,
            socket: res.socket,
          });
        });
      }
    );

    req.setTimeout(timeout, () => {
      req.destroy();
      done(new Error('Request timeout'));
    });

    req.on('error', (err) => done(err));

    req.end();
  });
}
