// See license.md

'use strict';

function isInterstitialURL(url) {
  if(!isURLObject(url)) {
    throw new TypeError();
  }

  const hosts = [
    'www.forbes.com',
    'forbes.com'
  ];
  return hosts.includes(url.hostname);
}
