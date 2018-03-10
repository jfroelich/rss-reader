
const rules = [];

export default function url_rewrite(url) {
  if (!(url instanceof URL)) {
    throw new TypeError('Invalid url parameter', url);
  }

  let prev = url;
  let next = url;
  for (const rule of rules) {
    prev = next;
    next = rule(prev) || prev;
  }

  return next;
}

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
