// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Remove elements with unwanted urls
// This is separate from sanity functions primarily because of when this is
// called. This is done before doing image dimension fetches. Otherwise the
// pings would still occur.
// TODO: this needs a lot of improvement
// TODO: I am not seeing any of the last 4 urls here being filtered. Maybe
// I am looking for the wrong thing.
function no_track_filter_elements(document) {

  const NO_TRACK_IMAGE_SELECTORS = [
    'img[src^="http://b.scorecardresearch.com"]',
    'img[src^="https://b.scorecardresearch.com"]',
    'img[src^="http://pagead2.googlesyndication.com"]',
    'img[src^="https://pagead2.googlesyndication.com"]',
    'img[src^="http://pubads.g.doubleclick.net"]',
    'img[src^="https://pubads.g.doubleclick.net"]'
  ];

  const NO_TRACK_IMAGE_SELECTOR = NO_TRACK_IMAGE_SELECTORS.join(',');

  // I only look for tracking elements within the body, because I assume
  // that out-of-body information is removed separately in the sanity
  // functions.
  const rootElement = document.body || document.documentElement;
  const imageNodeList = rootElement.querySelectorAll(NO_TRACK_IMAGE_SELECTOR);
  const listLength = imageNodeList.length;
  for(let i = 0, imageElement; i < listLength; i++) {
    imageElement = imageNodeList[i];
    console.debug('Removing tracker:', imageElement.outerHTML);
    imageElement.remove();
  }
}
