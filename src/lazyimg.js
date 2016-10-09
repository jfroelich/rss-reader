// See license.md

'use strict';

var rdr = rdr || {};
rdr.poll = rdr.poll || {};
rdr.poll.lazyimg = {};

rdr.poll.lazyimg.attrs = [
  'load-src',
  'data-src',
  'data-original-desktop',
  'data-baseurl',
  'data-lazy',
  'data-img-src',
  'data-original',
  'data-adaptive-img',
  'data-imgsrc',
  'data-default-src'
];

rdr.poll.lazyimg.updateImages = function(doc) {
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    rdr.poll.lazyimg.transform(img);
  }
};

rdr.poll.lazyimg.transform = function(img) {
  if(img.hasAttribute('src') || img.hasAttribute('srcset')) {
    return;
  }

  for(let altName of rdr.poll.lazyimg.attrs) {
    if(img.hasAttribute(altName)) {
      const altValue = img.getAttribute(altName);
      if(altValue && rdr.poll.lazyimg.isValidURL(altValue)) {
        img.removeAttribute(altName);
        img.setAttribute('src', altValue);
        return;
      }
    }
  }
};

// Only minimal validation against possibly relative urls
rdr.poll.lazyimg.isValidURL = function(str) {
  return !str.trim().includes(' ');
};
