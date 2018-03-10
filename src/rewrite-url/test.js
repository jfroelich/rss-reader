import {rewrite_url} from '/src/rewrite-url/rewrite-url.js';

function norewrite_test() {
  let a = new URL('https://www.google.com');
  let b = rewrite_url(a);
  console.assert(b.href === a.href, 'no rewrite');
}

function google_news_test() {
  let a = new URL('https://news.google.com/news/url');
  a.searchParams.set('url', 'https://www.google.com');
  let b = rewrite_url(a);
  console.assert(b.href === 'https://www.google.com/', 'google news');
}

function techcrunch_test() {
  let a = new URL('https://techcrunch.com');
  a.searchParams.set('ncid', '1234');
  let b = rewrite_url(a);
  console.assert(b.href === 'https://techcrunch.com/', 'techcrunch');
}

function cyclical_test() {
  let a = new URL('https://news.google.com/news/url');
  a.searchParams.set('url', 'https://techcrunch.com/foo?ncid=2');
  let b = rewrite_url(a);
  console.assert(b.href === 'https://techcrunch.com/foo', 'cyclical', b.href);
}

function run_tests() {
  norewrite_test();
  google_news_test();
  techcrunch_test();
  cyclical_test();
}

window.test = run_tests;
