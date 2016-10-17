// See license.md

'use strict';

// These websites do not display an article's content unless cookies are
// provided.
function isRequiresCookiesURL(url) {
  const hosts = ['www.heraldsun.com.au'];
  return hosts.includes(url.hostname);
}
