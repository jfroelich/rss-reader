
'use strict';

function testFaviconServiceLookup(pageURLString) {
  const service = new FaviconService('test-favicon-service', 5000);
  service.lookup(new URL(pageURLString), function(iconURL) {
    console.log(iconURL ? iconURL.href : 'No icon found');
  });
}
