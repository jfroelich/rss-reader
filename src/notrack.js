// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Lib for helping reduce the number of tracking elements in an HTML
// document.

const NO_TRACK_IMAGE_SRC_URLS = [
  'http://b.scorecardresearch.com',
  'https://b.scorecardresearch.com',
  'http://pagead2.googlesyndication.com',
  'https://pagead2.googlesyndication.com',
  'http://pubads.g.doubleclick.net',
  'https://pubads.g.doubleclick.net'
];

function no_track_make_image_selector_part(urlString) {
  'use strict';
  return 'IMG[src^="' + urlString + '"]';
}

const NO_TRACK_IMAGE_SELECTOR_PARTS = NO_TRACK_IMAGE_SRC_URLS.map(
  no_track_make_image_selector_part);
const NO_TRACK_IMAGE_SELECTOR = NO_TRACK_IMAGE_SELECTOR_PARTS.join(',');

// Remove elements with unwanted urls
// This is separate from sanity functions primarily because of when this is
// called. This is done before doing image dimension fetches. Otherwise the
// pings would still occur.
function no_track_filter_elements(document) {
  'use strict';

  // I only look for tracking elements within the body, because I assume
  // that out-of-body information is removed separately in the sanity
  // functions.

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const imageNodeList = bodyElement.querySelectorAll(NO_TRACK_IMAGE_SELECTOR);
  const listLength = imageNodeList.length;
  for(let i = 0, imageElement; i < listLength; i++) {
    imageElement = imageNodeList[i];
    console.debug('Removing tracking image or ad:', imageElement.outerHTML);
    imageElement.remove();
  }
}

function no_track_filter_tiny_images(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const imageNodeList = bodyElement.querySelectorAll('IMG');
  const listLength = imageNodeList.length;

  for(let i = 0, image; i < listLength; i++) {
    image = imageNodeList[i];
    if(image.width < 2 || image.height < 2) {
      image.remove();
    }
  }
}
