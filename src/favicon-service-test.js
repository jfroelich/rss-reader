
'use strict';

function testFaviconServiceLookup(pageURLString) {
  const databaseName = 'test-favicon-service';
  const timeoutMillis = 5000;

  // Leaving as true for now while I test for basic errors and such
  const isCacheless = true;

  const service = new FaviconService(databaseName, timeoutMillis, isCacheless);
  const pageURL = new URL(pageURLString);
  service.lookup(pageURL, onLookup);

  function onLookup(iconURL) {
    console.log(iconURL ? iconURL.href : 'No icon found');
  }
}
