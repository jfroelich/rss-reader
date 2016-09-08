
'use strict';

function test_lookup_favicon(url_str) {
  lookup_favicon(new URL(url_str), null, test_lookup_favicon_onlookup);
}

function test_lookup_favicon_onlookup(icon_url) {
  console.log(icon_url ? icon_url.href : 'No url');
}
