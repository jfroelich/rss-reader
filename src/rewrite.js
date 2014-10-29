// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Returns a rewritten url, or the original url if no rewriting rules were applicable.
 *
 * Currently this only works for Google News urls
 */
lucu.rewriteURL = function(string) {

  'use strict';

  var RE_GOOGLE_NEWS = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  // NOTES: if exec does not match it returns undefined/null. If it does match
  // and there is a sub capture, it returns [0] as the full text and [1] as
  // the text of the first sub capture.
  var matches = RE_GOOGLE_NEWS.exec(string);
  if(matches && matches.length === 2 && matches[1]) {
    var newURL = decodeURIComponent(matches[1]);
    return newURL;
  }

  return string;
};
