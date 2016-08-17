
'use strict';

function test_lookup_favicon(pageURLString) {
  lookup_favicon(new URL(pageURLString), null, test_lookup_favicon_onlookup);
}

function test_lookup_favicon_onlookup(iconURL) {
  console.log(iconURL ? iconURL.href : 'No url');
}
