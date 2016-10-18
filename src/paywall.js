// See license.md

'use strict';

// TODO: this eventually needs to be extendable, so that I can easily change
// the rules without changing the code

function is_paywall_url(url) {
  if(!is_url_object(url))
    throw new TypeError();
  const hostname = url.hostname;
  if(hostname.endsWith('nytimes.com')) {
    console.debug('Paywall url:', url.href);
    return true;
  }

  return false;
}
