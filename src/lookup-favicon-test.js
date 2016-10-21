// See license.md

'use strict';

// TODO: this should probably setup and tear down a test cache instead of
// using the real cache by default

function test(url_str) {
  const cache = new FaviconCache(console);
  const conn = null;
  const url = new URL(url_str);
  const doc = null;
  const callback = function(url) {
    console.log('Output:', url ? url.href : null);
  };
  lookup_favicon(cache, conn, url, doc, console, callback);
}
