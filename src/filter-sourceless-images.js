// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Removes images without a source
// TODO: think more about the interaction with lazy-load-transform.js, where
// image elements typically do not have a src attribute, but do have a data-src
// attribute. Essentially, this should be always be called _after_ that
// transform so this basically handles failure cases for that transform or
// actual sourceless image elements.
// TODO: look further into why I occassionally witness images without a src
// attribute. Why would someone ever do this? I think one reason might be
// that the src is set dynamically via script. I suppose I cannot support that
// case because scripting is not permitted. What are some other cases?

// NOTE: what about a transform that ensures image elements have no child
// nodes? Another type of scrubbing transform. Probably more general, that works
// with other similar elements

function filterSourcelessImages(document) {
  'use strict';

  // NOTE: we use querySelectorAll because we are iterating forward
  // NOTE: we do not use img:not([src]) or !image.hasAttribute('src') because
  // those fail to consider the care where an image src attribute is present
  // but does not contain any non whitespace characters

  const images = document.querySelectorAll('img');
  const numImages = images.length;
  for(let i = 0, image, source; i < numImages; i++) {
    image = images[i];
    source = (image.getAttribute('src') || '').trim();
    if(!source) {
      console.debug('Removing sourceless image [%s]', image.outerHTML);
      image.remove();
    }
  }
}
