// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

const FavIcon = {};

// Returns the favicon url for a given url, or a default image if url is
// undefined
FavIcon.getURL = function(url) {
  'use strict';

  if(url) {
    return 'http://www.google.com/s2/favicons?domain_url=' +
      encodeURIComponent(url);
  } else {
    return '/media/rss_icon_trans.gif';
  }
};
