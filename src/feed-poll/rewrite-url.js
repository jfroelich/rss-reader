// Applies a set of rules to a url object and returns a modified url object.
// Returns undefined if no rewriting occurred or unable to rewrite successfully.
// @param url {URL}
// @returns {URL}
export default function rewriteURL(url) {
  if(!(url instanceof URL)) {
    throw new TypeError('Invalid url parameter', url);
  }

  if(url.hostname === 'news.google.com' && url.pathname === '/news/url') {
    const param = url.searchParams.get('url');
    try {
      return new URL(param);
    } catch(error) {
      console.debug('Invalid url param', param);
    }
    return;
  } else if(url.hostname === 'techcrunch.com' && url.searchParams.has('ncid')) {
    // Only modify the clone for purity
    const output = new URL(url.href);
    output.searchParams.delete('ncid');
    return output;
  }
}
