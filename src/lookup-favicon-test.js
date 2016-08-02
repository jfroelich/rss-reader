
'use strict';

function testLookupFavicon(pageURLString) {
  lookupFavicon(new URL(pageURLString), null, testLookupFaviconOnLookup);
}

function testLookupFaviconOnLookup(iconURL) {
  console.log(iconURL ? iconURL.href : 'No url');
}
