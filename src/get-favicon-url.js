// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Returns the favicon url for a given url, or a default image if url is
// undefined
function getFaviconURL(url) {
  'use strict';

  if(url) {
    return 'http://www.google.com/s2/favicons?domain_url=' +
      encodeURIComponent(url);
  } else {
    return '/media/rss_icon_trans.gif';
  }
}
