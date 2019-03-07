export function google_news_rule(url) {
  if (url.hostname === 'news.google.com' && url.pathname === '/news/url') {
    const param = url.searchParams.get('url');
    try {
      return new URL(param);
    } catch (error) {
    }
  }
}

export function techcrunch_rule(url) {
  if (url.hostname === 'techcrunch.com' && url.searchParams.has('ncid')) {
    const output = new URL(url.href);
    output.searchParams.delete('ncid');
    return output;
  }
}

export function facebook_exit_rule(url) {
  if (url.hostname === 'l.facebook.com' && url.pathname === '/l.php') {
    const param = url.searchParams.get('u');
    try {
      return new URL(param);
    } catch (error) {
    }
  }
}
