// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Returns a url string pointing to the favicon associated with the input
// url string.
// TODO: this doesn't cache, which means every image request is going out,
// and the browser might cache, but otherwise it is providing tracking
// information. So maybe this should be async and store a local cache.
// TODO: I should probably store the post-redirect url as a feed property and
// query against that property on display, instead of calling this function
// per article.
function favicon_get_url(urlString) {
  'use strict';

  // Note: I originally rolled my own thing that did url parsing and
  // looked for a url. I gave up on that and just use Google's own
  // favicon service.

  if(urlString) {
    return 'http://www.google.com/s2/favicons?domain_url=' +
      encodeURIComponent(urlString);
  } else {
    return '/images/rss_icon_trans.gif';
  }
}
