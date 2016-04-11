// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file


// Derives a bias for an element based on child images
function calamine_derive_image_bias(parentElement) {
  'use strict';

  let bias = 0.0;
  let numImages = 0;
  let area = 0;

  // Walk the child elements, looking for images
  for(let element = parentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(element.nodeName !== 'IMG') {
      continue;
    }

    // Increase bias for containing a large image
    area = element.width * element.height;
    if(area) {
      bias = bias + (0.0015 * Math.min(100000.0, area));
    }

    // Increase bias for containing descriptive information
    if(element.getAttribute('alt')) {
      bias = bias + 20.0;
    }

    if(element.getAttribute('title')) {
      bias = bias + 30.0;
    }

    if(calamine_find_image_caption(element)) {
      bias = bias + 100.0;
    }

    numImages++;
  }

  // Penalize elements containing multiple images. These are usually
  // carousels.
  if(numImages > 1) {
    bias = bias + (-50.0 * (numImages - 1));
  }

  return bias;
}

// Finds the associated caption element for an image.
function calamine_find_image_caption(image) {
  'use strict';

  // NOTE: unsure if closest works with uppercase

  const figure = image.closest('figure');
  return figure ? figure.querySelector('FIGCAPTION') : null;
}
