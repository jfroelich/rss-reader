import assert from '/src/lib/assert.js';
import {rewrite_url} from '/src/lib/rewrite-url.js';
import {register_test} from '/src/test/test-registry.js';

// TODO: I've temporarily copied over the rules here for testing, but ideally
// this should import the rules from somewhere, or, define local rules and test
// against those exclusively. I should not even be testing the real rules, I
// should only be exercising the function behavior and asserting against its
// expected vs actual behavior

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

async function rewrite_url_norewrite_test() {
  let a = new URL('https://www.google.com');
  let b = rewrite_url(a, rules);
  assert(b.href === a.href, 'no rewrite');
}

async function rewrite_url_google_news_test() {
  let a = new URL('https://news.google.com/news/url');
  a.searchParams.set('url', 'https://www.google.com');
  let b = rewrite_url(a, rules);
  assert(b.href === 'https://www.google.com/', 'google news');
}

async function rewrite_url_techcrunch_test() {
  let a = new URL('https://techcrunch.com');
  a.searchParams.set('ncid', '1234');
  let b = rewrite_url(a, rules);
  assert(b.href === 'https://techcrunch.com/', 'techcrunch');
}

async function rewrite_url_cyclical_test() {
  let a = new URL('https://news.google.com/news/url');
  a.searchParams.set('url', 'https://techcrunch.com/foo?ncid=2');
  let b = rewrite_url(a, rules);
  assert(b.href === 'https://techcrunch.com/foo', 'cyclical ' + b.href);
}

register_test(rewrite_url_norewrite_test);
register_test(rewrite_url_google_news_test);
register_test(rewrite_url_techcrunch_test);
register_test(rewrite_url_cyclical_test);
