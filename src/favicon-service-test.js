
'use strict';

const FaviconServiceTest = Object.create(null);

FaviconServiceTest.lookup = function(urlString) {
  FaviconService.getFavIconURL(new URL(urlString), function(faviconURL) {
    if(faviconURL) {
      console.log('favicon url:', faviconURL.href);
    } else {
      console.log('could not locate favicon url');
    }
  });
};
