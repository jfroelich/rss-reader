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

this.transform_lazy_images = function(document) {
  const images = document.querySelectorAll('img');
  for(let image of images) {
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      for(let alternateName of LAZY_ATTRIBUTES) {
        if(image.hasAttribute(alternateName)) {
          const alternateValue = image.getAttribute(alternateName);
          if(alternateValue && is_valid_url(alternateValue)) {
            image.removeAttribute(alternateName);
            image.setAttribute('src', alternateValue);
            return;
          }
        }
      }
    }
  }
};

// Only minimal validation. I cannot fully validate its url, because the url
// could be relative
// TODO: i should still match browser behavior though, which might tolerate
// spaces in urls
function is_valid_url(inputString) {
  return !inputString.trim().includes(' ');
}

} // End file block scope
