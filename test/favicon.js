
function test_favicon_onload(event) {
  'use strict';

  const testInputURL = new URL('http://www.google.com');
  const favIconService = new FavIcon();

  favIconService.getFavIconURLString(testInputURL, function on_get_url(fiURL) {
    if(fiURL) {
      console.debug('favicon url:', fiURL);
    }
  });

}

document.addEventListener('DOMContentLoaded', test_favicon_onload);
