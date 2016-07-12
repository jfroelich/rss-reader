// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const DEFAULT_FAV_ICON_URL = new URL(
  chrome.extension.getURL('/images/rss_icon_trans.gif'));

// Returns a url object pointing to the favicon associated with the input
// url object.
// This can throw an exception if there is a URL parsing error but in practice
// this should never happen, so I do not guard against it here. But the caller
// should be aware.
function getFavIconURL(inputURL) {
  let outputURL = null;
  if(inputURL) {
    const baseURLString = 'http://www.google.com/s2/favicons?domain_url=';
    const outputURLString = baseURLString + encodeURIComponent(inputURL.href);
    outputURL = new URL(outputURLString);
  } else {
    // Create a new URL object to maintain immutability
    outputURL = new URL(DEFAULT_FAV_ICON_URL.href);
  }

  return outputURL;
}
