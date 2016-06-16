// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const DEFAULT_FAV_ICON_URL = new URL(
  chrome.extension.getURL('/images/rss_icon_trans.gif'));

// Returns a url object pointing to the favicon associated with the input
// url object.
// NOTE: I originally rolled my own thing that did url parsing and
// looked for a url. I gave up on that and just use Google's own
// favicon service. I am still considering my own local service.
// TODO: this doesn't cache, which means every image request is going out,
// and the browser might cache, but otherwise it is providing tracking
// information. Maybe this should use a local cache.
// TODO: maybe I should perform this lookup async via an HTTP HEAD request
// and get the post redirect URL and do this during polling, so that I do
// not hit up google per render. I should store the result as a property of
// each entry and each feed. The only thing is I need to do this both at
// subscribe and at poll so i account for changes to favicon?

function getFavIconURL(inputURL) {
  let outputURL = null;
  if(inputURL) {
    const baseURLString = 'http://www.google.com/s2/favicons?domain_url=';
    const outputURLString = baseURLString + encodeURIComponent(inputURL.href);
    outputURL = new URL(outputURLString);
  } else {
    outputURL = DEFAULT_FAV_ICON_URL;
  }

  return outputURL;
}
