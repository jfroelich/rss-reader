import {google_news_rule} from '/src/config/rewrite-rules.js';
import {techcrunch_rule} from '/src/config/rewrite-rules.js';
import assert from '/src/lib/assert.js';
import {rewrite_url} from '/src/ops/import-entry.js';

export async function rewrite_url_norewrite_test() {
  const rules = [];
  rules.push(google_news_rule);
  rules.push(techcrunch_rule);
  let a = new URL('https://www.google.com');
  let b = rewrite_url(a, rules);
  assert(b.href === a.href, 'no rewrite');
}

export function rewrite_url_google_news_test() {
  const rules = [];
  rules.push(google_news_rule);
  rules.push(techcrunch_rule);
  let a = new URL('https://news.google.com/news/url');
  a.searchParams.set('url', 'https://www.google.com');
  let b = rewrite_url(a, rules);
  assert(b.href === 'https://www.google.com/', 'google news');
}

export function rewrite_url_techcrunch_test() {
  const rules = [];
  rules.push(google_news_rule);
  rules.push(techcrunch_rule);
  let a = new URL('https://techcrunch.com');
  a.searchParams.set('ncid', '1234');
  let b = rewrite_url(a, rules);
  assert(b.href === 'https://techcrunch.com/', 'techcrunch');
}

export function rewrite_url_cyclical_test() {
  const rules = [];
  rules.push(google_news_rule);
  rules.push(techcrunch_rule);
  let a = new URL('https://news.google.com/news/url');
  a.searchParams.set('url', 'https://techcrunch.com/foo?ncid=2');
  let b = rewrite_url(a, rules);
  assert(b.href === 'https://techcrunch.com/foo', 'cyclical ' + b.href);
}
