import * as config from '/src/config/config.js';
import assert from '/src/lib/assert.js';
import {rewrite_url} from '/src/ops/import-entry.js';

// Exercise the rewrite-url helper
export async function rewrite_tests() {
  const rules = config.get_rewrite_rules();

  let a = new URL('https://www.google.com');
  let b = rewrite_url(a, rules);
  assert(b.href === a.href);

  a = new URL('https://news.google.com/news/url');
  a.searchParams.set('url', 'https://www.google.com');
  b = rewrite_url(a, rules);
  assert(b.href === 'https://www.google.com/', 'google news');

  a = new URL('https://techcrunch.com');
  a.searchParams.set('ncid', '1234');
  b = rewrite_url(a, rules);
  assert(b.href === 'https://techcrunch.com/', 'techcrunch');

  a = new URL('https://news.google.com/news/url');
  a.searchParams.set('url', 'https://techcrunch.com/foo?ncid=2');
  b = rewrite_url(a, rules);
  assert(b.href === 'https://techcrunch.com/foo', 'cyclical ' + b.href);
}
