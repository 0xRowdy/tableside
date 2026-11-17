// Spec 2 Amendment 8 §5; spec 7 D13

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROVIDER_AUTHORIZE_URLS, STORES, WEB_PAGES } from '@tableside/account/web';
import { describe, expect, it } from 'vitest';

const app = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFile(join(app, path), 'utf8');

describe('the web account page', () => {
  it('loads only its own script and stylesheet', async () => {
    const html = await read('index.html');
    const sources = [...html.matchAll(/<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
    expect(sources).toEqual(['/style.css', '/src/main.ts']);
  });

  it('lets nothing but the page itself and its backend load or connect', async () => {
    const html = await read('index.html');
    const policy = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1];
    expect(policy?.split(';').map((directive) => directive.trim())).toEqual([
      "default-src 'none'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self'",
      "font-src 'none'",
      'connect-src \'self\' %TABLESIDE_WEB_SUPABASE_URL%',
      "base-uri 'none'",
      "form-action 'none'",
    ]);
  });

  it('fetches no font and imports no stylesheet', async () => {
    const css = await read('public/style.css');
    expect(css).not.toMatch(/@import|@font-face|url\(/);
  });

  it('names no other origin in its scripts than the links it shows', async () => {
    const files = (await readdir(join(app, 'src'))).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
    for (const name of files) expect(await read(join('src', name)), name).not.toMatch(/https?:\/\//);
    const allowed = [
      ...Object.values(STORES).flatMap((store) => [store.manageUrl, store.refundUrl]),
      ...Object.values(WEB_PAGES),
      ...Object.values(PROVIDER_AUTHORIZE_URLS),
    ];
    for (const url of allowed) expect(new URL(url).protocol).toBe('https:');
  });
});
