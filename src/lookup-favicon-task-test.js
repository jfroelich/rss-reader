
'use strict';

// TODO: this should probably setup and tear down a test cache instead of
// using the real cache by default

function lookup(urlString) {
  const task = new LookupFaviconTask();
  task.log.enabled = true;
  task.cache.log.enabled = true;
  task.start(new URL(urlString), null, function(url) {
    console.log('Output:', url ? url.href : null);
  });
}
