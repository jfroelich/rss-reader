// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Rewriting lib. lucu needs basic rewriting functionality in order to prefetch
// pages. Certain data sources that provide urls to fetch try and proxy the urls
// through an intermediate tracking page. This unfortunately prevents lucu from
// being able to properly prefetch. Therefore, this module helps skip past
// known popular proxies.
//
// This is loosely modeled after Apache's mod_rewrite.
//
// In a prior version the rules were editable by users but I deemed it too difficult
// so rules are now hard coded.
//
// TODO: avoid hard-coding rules in logic. Use some type of JSON-like external spec
// object singleton that gets used here.

'use strict';

var lucu = lucu || {};
lucu.rewrite = {};

lucu.rewrite.RE_GOOGLE_NEWS = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;

// Returns a rewritten url, or the original url if no rewriting rules were applicable.
lucu.rewrite.rewriteURL = function(string) {

  // NOTES: if exec does not match it returns undefined/null. If it does match
  // and there is a sub capture, it returns [0] as the full text and [1] as
  // the text of the first sub capture.

  var matches = lucu.rewrite.RE_GOOGLE_NEWS.exec(string);

  if(matches && matches.length === 2 && matches[1]) {
    var newURL = decodeURIComponent(matches[1]);
    return newURL;
  }

  return string;
};
