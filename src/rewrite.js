// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Returns a rewritten url, or the original url if no rewriting rules were
 * applicable.
 */
lucu.rewriteURL = function(url) {
  'use strict';
  const RE_GOOGLE_NEWS = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  const matches = RE_GOOGLE_NEWS.exec(url);
  if(matches && matches.length === 2 && matches[1]) {
    const newURL = decodeURIComponent(matches[1]);
    return newURL;
  }

  return url;
};
