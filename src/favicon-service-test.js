
'use strict';

let service = null;

window.addEventListener('DOMContentLoaded', function(event) {
  service = new FaviconService();
  service.log.level = LoggingService.LEVEL_DEBUG;
  service.timeout = 5000;
  service.cache.name = 'test-favicon-cache';
  service.cache.log.level = LoggingService.LEVEL_DEBUG;
});

function testFaviconServiceLookup(pageURLString) {
  service.lookup(new URL(pageURLString), null, testFaviconServiceOnLookup);
}

function testFaviconServiceOnLookup(iconURL) {
  console.log(iconURL ? iconURL.href : 'No url');
}
