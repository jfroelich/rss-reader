// See license.md

'use strict';

function test(urlString) {
  const requestURL = new URL(urlString);
  const excludeEntries = false;
  const verbose = true;
  fetchFeed(requestURL, excludeEntries, verbose, function(event) {
    console.dir(event);
  });
}
