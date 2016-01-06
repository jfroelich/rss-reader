// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Removes images without a source. This should only be called after
// transformLazyImages because that function may derive a source property for
// an otherwise sourceless image.
function filterSourcelessImages(document) {
  'use strict';

  // NOTE: we use querySelectorAll because we are mutating while iterating
  // forward
  // NOTE: using hasAttribute allows for whitespace-only values, but I do not
  // think this is too important
  // NOTE: access by attribute, not by property, because the browser may
  // supply a base url prefix or something like that to the property
  // TODO: use for..of once Chrome supports iterable NodeLists
  // TODO: eventually stop logging. For now it helps as a way to
  // identify new lazily-loaded images

  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0, image; i < numImages; i++) {
    image = images[i];
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      console.debug('Removing sourceless image: %s', image.outerHTML);
      image.remove();
    }
  }
}
