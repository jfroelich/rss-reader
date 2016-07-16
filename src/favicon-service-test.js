
'use strict';

function testFaviconServiceLookup(pageURLString) {

  const service = new FaviconService();
  service.timeout = 5000;

  const dbCache = new FaviconServiceIndexedDBCache('test-favicon-service');

  const dummyCache = new FaviconDummyCache('test-dummy-cache');

  service.cache = dummyCache;

  const pageURL = new URL(pageURLString);
  service.lookup(pageURL, onLookup);

  function onLookup(iconURL) {
    console.log(iconURL ? 'Favicon url: ' + iconURL.href : 'No favicon found');
  }
}
