// See license.md

'use strict';

// These websites do not display an article's content unless cookies are
// provided.
function is_requires_cookies_url(url) {
  const hosts = ['www.heraldsun.com.au'];
  return hosts.includes(url.hostname);
}
