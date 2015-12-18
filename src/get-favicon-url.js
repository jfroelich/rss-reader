// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: change into a simple function, no need for class
// move use strict to within function


'use strict';

class FavIcon {
  static getURL(url) {
    if(url) {
      return 'http://www.google.com/s2/favicons?domain_url=' +
        encodeURIComponent(url);
    } else {
      return '/media/rss_icon_trans.gif';
    }
  }
}
