// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: this doesn't cache, which means every image request is going out,
// and the browser might cache, but otherwise it is providing tracking
// information. So maybe this should be async and store a local cache. Also,
// I should probably store the post-redirect url as a feed property and query
// against that property on display, instead of calling this function
// per article.
function favicon_get_url(url) {
  'use strict';

  if(url) {
    return 'http://www.google.com/s2/favicons?domain_url=' +
      encodeURIComponent(url);
  } else {
    return '/images/rss_icon_trans.gif';
  }
}
