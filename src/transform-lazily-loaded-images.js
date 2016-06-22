// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// todo; try using for of to iterate
function transformLazilyLoadedImages(document) {

  const ALTERNATE_ATTRIBUTE_NAMES = [
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

  const numNames = ALTERNATE_ATTRIBUTE_NAMES.length;
  const images = document.querySelectorAll('img');
  for(let i = 0, j = 0, len = images.length, image, name, altSrc; i < len;
    i++) {
    image = images[i];
    if(!(image.getAttribute('src') || '').trim()) {
      for(j = 0; j < numNames; j++) {
        name = ALTERNATE_ATTRIBUTE_NAMES[j];
        if(image.hasAttribute(name)) {
          altSrc = (image.getAttribute(name) || '').trim();
          if(altSrc && !altSrc.includes(' ')) {
            image.removeAttribute(name);
            image.setAttribute('src', altSrc);
            break;
          }
        }
      }
    }
  }
}
