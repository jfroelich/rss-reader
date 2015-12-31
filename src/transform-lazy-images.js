// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN FILE SCOPE

// Modifies various image elements that appear as lazily-loaded in an effort
// to improve the number of images captured, given that scripting is disabled.
// This should occur prior to removing sourceless images, and prior to trying
// to set image dimensions.
function transformLazyImages(document) {
  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0; i < numImages; i++) {
    transformImageElement(images[i]);
  }
}

// Export global
this.transformLazyImages = transformLazyImages;

function transformImageElement(image) {

  // Test the various rules, and if one matches, modify the image
  // Eventually, this could be designed to work off a collection of rules
  // Or we could look for all url-like attributes?
  // http://stackoverflow.com/questions/1500260

  // TODO: should I not be removing attributes? Maybe the only thing we care
  // about is ensuring that src is set

  // Case 1: <img lazy-state="queue" load-src="url">
  if(image.hasAttribute('lazy-state') &&
    image.getAttribute('lazy-state') === 'queue') {
    console.debug('Transforming lazily-loaded image ', image.outerHTML);
    image.setAttribute('src', image.getAttribute('load-src'));
    return;
  }

  // Case 2: <img load-src="url">
  if(!image.hasAttribute('src') && image.hasAttribute('load-src')) {
    console.debug('Transforming lazily-loaded image ', image.outerHTML);
    image.setAttribute('src', image.getAttribute('load-src'));
    return;
  }

  // Case 3: <img src="blankurl" class="lazy-image" data-src="url">
  if(image.dataset && image.dataset.src &&
    image.classList.contains('lazy-image')) {
    console.debug('Transforming lazily-loaded image ', image.outerHTML);
    image.setAttribute('src', image.dataset.src);
    return;
  }
}

} // END FILE SCOPE
