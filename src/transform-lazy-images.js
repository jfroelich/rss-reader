// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// TODO: Still see cases like this: <img data-original="url" src="url">
// Instead of checking for absence of src, maybe always overwrite

const LAZY_ATTRIBUTES = [
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

function transformLazyImages(doc) {
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    transformLazyImage(img);
  }
}

function transformLazyImage(img) {

  if(img.hasAttribute('src') || img.hasAttribute('srcset')) {
    return;
  }

  for(let altName of LAZY_ATTRIBUTES) {
    if(img.hasAttribute(altName)) {
      const altValue = img.getAttribute(altName);
      if(altValue && isValidURL(altValue)) {
        img.removeAttribute(altName);
        img.setAttribute('src', altValue);
        return;
      }
    }
  }
}

// Only minimal validation. I cannot fully validate its url, because the url
// could be relative
// TODO: i should still match browser behavior though, which might tolerate
// spaces in urls
function isValidURL(inputString) {
  return !inputString.trim().includes(' ');
}

this.transformLazyImages = transformLazyImages;

} // End file block scope
