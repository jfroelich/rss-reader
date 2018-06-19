
export function build_rewrite_rules() {
  const rules = [];
  rules.push(google_news_rule);
  rules.push(techcrunch_rule);
  rules.push(facebook_exit_rule);
  return rules;
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

function techcrunch_rule(url) {
  if (url.hostname === 'techcrunch.com' && url.searchParams.has('ncid')) {
    const output = new URL(url.href);
    output.searchParams.delete('ncid');
    return output;
  }
}

function facebook_exit_rule(url) {
  if (url.hostname === 'l.facebook.com' && url.pathname === '/l.php') {
    const param = url.searchParams.get('u');
    try {
      return new URL(param);
    } catch (error) {
    }
  }
}
