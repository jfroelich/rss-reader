// See license.md

'use strict';

function test(urlString) {
  const requestURL = new URL(urlString);
  const excludeEntries = false;
  fetchFeed(requestURL, excludeEntries, console, function(event) {
    console.dir(event);
  });
}
