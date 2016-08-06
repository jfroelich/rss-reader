
'use strict';

function testLookupFavicon(pageURLString) {
  favicon.lookup(new URL(pageURLString), null, testLookupFaviconOnLookup);
}

function testLookupFaviconOnLookup(iconURL) {
  console.log(iconURL ? iconURL.href : 'No url');
}
