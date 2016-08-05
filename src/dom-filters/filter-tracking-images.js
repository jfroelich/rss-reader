// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: can i just access image.src property to get hostname
// instead of creating url from attribute value?
// TODO: restrict to http(s)? (by protocol value)?
function filterTrackingImages(document) {
  // Use all lowercase to match hostname getter normalization
  const hosts = new Set([
    'b.scorecardresearch.com',
    'googleads.g.doubleclick.net',
    'me.effectivemeasure.net',
    'pagead2.googlesyndication.com',
    'pixel.quantserve.com',
    'pixel.wp.com',
    'pubads.g.doubleclick.net',
    'sb.scorecardresearch.com'
  ]);

  const minURLLength = 'http://a.com'.length;
  const images = document.querySelectorAll('img[src]');
  for(let image of images) {
    const src = image.getAttribute('src');
    if(src && src.length > minURLLength) {
      const url = filterTrackingImagesToURLTrapped(src);
      if(url && hosts.has(url.hostname)) {
        image.remove();
      }
    }
  }
}

function filterTrackingImagesToURLTrapped(urlString) {
  try {
    return new URL(urlString);
  } catch(exception) {
  }
}
