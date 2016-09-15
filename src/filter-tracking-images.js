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

const minValidURLLength = 'http://a.tld/a'.length;

// TODO: restrict to http(s)? (by protocol value)?
function isTrackingImage(image) {
  const src = image.getAttribute('src');

  if(!src) {
    return false;
  }

  // TODO: is min length the right condition? Maybe just check for space after
  // trim, or not even check min length?
  if(src.length < minValidURLLength) {
    return false;
  }

  let url;
  try {
    url = new URL(src);
  } catch(error) {
    return false;
  }

  const normalizedLowercaseHostname = url.hostname;
  return hostNames.includes(normalizedLowercaseHostname);
}

this.filterTrackingImages = filterTrackingImages;

} // End file block scope
