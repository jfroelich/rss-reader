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
      for(let alt_name of LAZY_ATTRIBUTES) {
        if(image.hasAttribute(alt_name)) {
          const alt_value = image.getAttribute(alt_name);
          if(alt_value && is_valid_url(alt_value)) {
            image.removeAttribute(alt_name);
            image.setAttribute('src', alt_value);
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
function is_valid_url(input_str) {
  return !input_str.trim().includes(' ');
}

} // End file block scope
