
'use strict';

function testLookupFavicon(urlString) {
  lookupFavicon(new URL(urlString), null, function(iconURLObject) {
    console.log(iconURLObject ? iconURLObject.href : 'Not found');
  });
}
