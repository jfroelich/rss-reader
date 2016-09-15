// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// TODO: hosts should be defined externally so that if i want to
// change it, I don't have to change the code

const hostNames = [
  'ad.doubleclick.net',
  'b.scorecardresearch.com',
  'googleads.g.doubleclick.net',
  'me.effectivemeasure.net',
  'pagead2.googlesyndication.com',
  'pixel.quantserve.com',
  'pixel.wp.com',
  'pubads.g.doubleclick.net',
  'sb.scorecardresearch.com'
];

function filterTrackingImages(doc) {
  const images = doc.querySelectorAll('img[src]');
  for(let image of images) {
    if(isTrackingImage(image)) {
      image.remove();
    }
  }
}

function isTrackingImage(image) {
  let src = image.getAttribute('src');

  // Assert attribute exists
  if(!src) {
    return false;
  }

  // Assert non-empty string after trim
  src = src.trim();
  if(!src) {
    return false;
  }

  // Assert an approximate minimum length
  const minValidURLLength = 'http://a.d/a'.length;
  if(src.length < minValidURLLength) {
    return false;
  }

  // Assert no intermediate spaces (we trimmed above)
  if(src.includes(' ')) {
    return false;
  }

  // Assert acceptable protocol (http or https). No leading spaces (trimmed)
  if(!/^https?:/i.test(src)) {
    return false;
  }

  // Assert general url validity by checking for a parse error
  let url;
  try {
    url = new URL(src);
  } catch(error) {
    return false;
  }

  // Do the lookup using the normalized lowercase value
  return hostNames.includes(url.hostname);
}

this.filterTrackingImages = filterTrackingImages;

} // End file block scope
