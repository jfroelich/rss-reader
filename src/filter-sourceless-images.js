// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Scan the document for image elements that do not have a source value.
// Although hasAttribute yields false negatives in the case a src attribute
// is present but contains an empty value, I consider this sufficiently
// accurate.
function filterSourcelessImages(document) {
  const images = document.querySelectorAll('img');
  for(let image of images) {
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      // console.debug('Removing sourcless image', image.outerHTML);
      image.remove();
      break;
    }
  }
}
