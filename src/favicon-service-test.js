
'use strict';

function testFaviconServiceLookup(pageURLString) {

  const service = new FaviconService();
  service.timeout = 5000;

  //const cache = new FaviconIDBCache('test-favicon-service');
  const cache = new FaviconDummyCache('test-dummy-cache');
  service.cache = cache;

  const pageURL = new URL(pageURLString);
  const forceReload = false;
  service.lookup(pageURL, forceReload, onLookup);

  function onLookup(iconURL) {
    console.log(iconURL ? 'Favicon url: ' + iconURL.href : 'No favicon found');
  }
}
