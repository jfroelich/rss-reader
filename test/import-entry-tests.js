import assert from '/lib/assert.js';
import * as config from '/src/config.js';
import { rewriteURL } from '/src/import-entry.js';

// Exercise the rewrite-url helper
export async function rewrite_tests() {
  const rules = config.getRewriteRules();

  let a = new URL('https://www.google.com');
  let b = rewriteURL(a, rules);
  assert(b.href === a.href);

  a = new URL('https://news.google.com/news/url');
  a.searchParams.set('url', 'https://www.google.com');
  b = rewriteURL(a, rules);
  assert(b.href === 'https://www.google.com/', 'google news');

  a = new URL('https://techcrunch.com');
  a.searchParams.set('ncid', '1234');
  b = rewriteURL(a, rules);
  assert(b.href === 'https://techcrunch.com/', 'techcrunch');

  a = new URL('https://news.google.com/news/url');
  a.searchParams.set('url', 'https://techcrunch.com/foo?ncid=2');
  b = rewriteURL(a, rules);
  assert(b.href === 'https://techcrunch.com/foo', `cyclical ${b.href}`);
}
