'use strict';

function testFetchFeed(urlString) {
  const excludeEntries = false;
  fetchFeed(new URL(urlString), excludeEntries, function(event) {
    console.dir(event);
  });
}
