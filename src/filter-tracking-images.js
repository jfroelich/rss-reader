// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Remove images that merely serve to register http requests for website
// statistics
function filterTrackingImages(document) {
  const images = selectTrackingImages(document);
  for(let i = 0, len = images.length; i < len; i++) {
    images[i].remove();
  }
}

function selectTrackingImages(document) {
  // TODO: I am not seeing any of the last 4 urls here being filtered. Maybe
  // I am looking for the wrong thing? I have not seen these occur even
  // once? Are they just script origins?
  const SELECTOR = [
    'img[src^="http://b.scorecardresearch.com"]',
    'img[src^="https://b.scorecardresearch.com"]',
    'img[src^="http://pagead2.googlesyndication.com"]',
    'img[src^="https://pagead2.googlesyndication.com"]',
    'img[src^="http://pubads.g.doubleclick.net"]',
    'img[src^="https://pubads.g.doubleclick.net"]'
  ].join(',');
  return document.querySelectorAll(SELECTOR);
}
