// See license.md

'use strict';

function is_interstitial_url(url) {
  if(!is_url_object(url))
    throw new TypeError();
  const hosts = [
    'www.forbes.com',
    'forbes.com'
  ];
  return hosts.includes(url.hostname);
}
