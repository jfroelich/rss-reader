
'use strict';

function testLookupFavicon(urlString) {
  rdr.favicon.lookup(new URL(urlString), null, function(url) {
    console.log(iconURLObject ? url.href : 'Not found');
  });
}
