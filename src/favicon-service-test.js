
'use strict';

// TODO: this should probably setup and tear down a test cache instead of
// using the real cache by default

function lookup(urlString) {
  const service = new FaviconService();
  service.verbose = true;
  service.cache.verbose = true;
  service.lookup(new URL(urlString), null, function(url) {
    console.log('Output:', url ? url.href : null);
  });
}
