'use strict';

function testFetchFeed(urlString) {
  const excludeEntries = false;
  rdr.feed.fetch(new URL(urlString), excludeEntries, function(event) {
    console.dir(event);
  });
}
