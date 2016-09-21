// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: hosts should be defined externally so that if i want to
// change it, I don't have to change the code

var rdr = rdr || {};
rdr.poll = rdr.poll || {};

rdr.poll.trackingHostNames = [
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

rdr.poll.filterTrackingImages = function(doc) {
  const images = doc.querySelectorAll('img[src]');
  for(let image of images) {
    if(rdr.poll.isTrackingImage(image)) {
      image.remove();
    }
  }
};

rdr.poll.isTrackingImage = function(image) {
  let src = image.getAttribute('src');
  if(!src) {
    return false;
  }

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

  if(!/^https?:/i.test(src)) {
    return false;
  }

  let url;
  try {
    url = new URL(src);
  } catch(error) {
    return false;
  }

  return rdr.poll.trackingHostNames.includes(url.hostname);
};
