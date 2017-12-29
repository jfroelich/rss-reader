import assert from "/src/common/assert.js";

// TODO: accept a URL as input instead of a string. This will avoid the need to parse it here,
// and avoid the ickiness with the assertion and exception throwing

// Applies a set of rules to a url object and returns a modified url object. Returns undefined if
// no rewriting occurred.
// @param url {String}
// @returns {String}
export default function rewriteURL(url) {

  assert(typeof url === 'string' && url.length > 0);

  // This fails and throws a TypeError if the url is invalid or relative
  const urlObject = new URL(url);


  if(urlObject.hostname === 'news.google.com' && urlObject.pathname === '/news/url') {
    return urlObject.searchParams.get('url');
  } else if(urlObject.hostname === 'techcrunch.com' && urlObject.searchParams.has('ncid')) {
    urlObject.searchParams.delete('ncid');
    return urlObject.href;
  }
}
