// URL rewriting library

'use strict';

// Dependencies:
// none


// Applies a set of rules to a url object and returns a modified url object
// Returns undefined if no rewriting occurred
// @param url {String}
// @returns {String}
function rewrite_url(url) {
  const url_object = new URL(url);
  if(url_object.hostname === 'news.google.com' &&
    url_object.pathname === '/news/url') {
    return url_object.searchParams.get('url');
  } else if(url_object.hostname === 'techcrunch.com' &&
    url_object.searchParams.has('ncid')) {
    url_object.searchParams.delete('ncid');
    return url_object.href;
  }
}
