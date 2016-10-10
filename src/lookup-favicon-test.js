// See license.md

'use strict';

// TODO: this should probably setup and tear down a test cache instead of
// using the real cache by default

function test(urlString) {
  const cache = new FaviconCache();
  cache.log = console;

  const url = new URL(urlString);
  const doc = null;
  const verbose = true;
  const callback = function(url) {
    console.log('Output:', url ? url.href : null);
  };

  lookupFavicon(cache, url, doc, verbose, callback);
}
