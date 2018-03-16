import {rewrite_url} from '/src/rewrite-url/rewrite-url.js';

// TODO: I've temporarily copied over the rules here for testing, but ideally
// this should import the rules from somewhere, or, define local rules and test
// against those exclusively.
const rules = [];


function google_news_rule(url) {
  if (url.hostname === 'news.google.com' && url.pathname === '/news/url') {
    const param = url.searchParams.get('url');
    try {
      return new URL(param);
    } catch (error) {
    }
  }
}

rules.push(google_news_rule);

function techcrunch_rule(url) {
  if (url.hostname === 'techcrunch.com' && url.searchParams.has('ncid')) {
    const output = new URL(url.href);
    output.searchParams.delete('ncid');
    return output;
  }
}

rules.push(techcrunch_rule);


function norewrite_test() {
  let a = new URL('https://www.google.com');
  let b = rewrite_url(a, rules);
  console.assert(b.href === a.href, 'no rewrite');
}

function google_news_test() {
  let a = new URL('https://news.google.com/news/url');
  a.searchParams.set('url', 'https://www.google.com');
  let b = rewrite_url(a, rules);
  console.assert(b.href === 'https://www.google.com/', 'google news');
}

function techcrunch_test() {
  let a = new URL('https://techcrunch.com');
  a.searchParams.set('ncid', '1234');
  let b = rewrite_url(a, rules);
  console.assert(b.href === 'https://techcrunch.com/', 'techcrunch');
}

function cyclical_test() {
  let a = new URL('https://news.google.com/news/url');
  a.searchParams.set('url', 'https://techcrunch.com/foo?ncid=2');
  let b = rewrite_url(a, rules);
  console.assert(b.href === 'https://techcrunch.com/foo', 'cyclical', b.href);
}

function run_tests() {
  norewrite_test();
  google_news_test();
  techcrunch_test();
  cyclical_test();
}

window.test = run_tests;
