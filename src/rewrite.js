// See license.md

'use strict';

// Applies a set of rules to a url object and returns a modified url object
// @param url {String}
// @returns {String}
function rewrite_url(url) {
  const urlo = new URL(url);
  if(urlo.hostname === 'news.google.com' && urlo.pathname === '/news/url') {
    return urlo.searchParams.get('url');
  } else if(urlo.hostname === 'techcrunch.com' &&
    urlo.searchParams.has('ncid')) {
    urlo.searchParams.delete('ncid');
    return urlo.href;
  }
}
