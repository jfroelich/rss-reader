// URL rewriting module

import assert from "/src/assert.js";
import {isCanonicalURLString} from "/src/url/url-string.js";

// Applies a set of rules to a url object and returns a modified url object. Returns undefined if
// no rewriting occurred.
// @param url {String}
// @returns {String}
export default function rewriteURL(url) {
  assert(isCanonicalURLString(url));

  const urlObject = new URL(url);
  if(urlObject.hostname === 'news.google.com' && urlObject.pathname === '/news/url') {
    return urlObject.searchParams.get('url');
  } else if(urlObject.hostname === 'techcrunch.com' && urlObject.searchParams.has('ncid')) {
    urlObject.searchParams.delete('ncid');
    return urlObject.href;
  }
}
