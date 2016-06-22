// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

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

  const images = document.querySelectorAll('img');

  for(let image of images) {
    if(!(image.getAttribute('src') || '').trim()) {
      for(let alternateName of ALTERNATE_ATTRIBUTE_NAMES) {
        if(image.hasAttribute(alternateName)) {
          const alternateValue = (image.getAttribute(alternateName) ||
            '').trim();
          if(alternateValue && !alternateValue.includes(' ')) {
            // console.debug('Modifying lazy image element', image.outerHTML);
            image.removeAttribute(alternateName);
            image.setAttribute('src', alternateValue);
            break;
          }
        }
      }
    }
  }
}
