
'use strict';

function testLookupFavicon(urlString) {
  const doc = null;
  const verbose = true;
  rdr.favicon.lookup(new URL(urlString), doc, verbose, function(url) {
    console.log('Output:', url ? url.href : null);
  });
}
