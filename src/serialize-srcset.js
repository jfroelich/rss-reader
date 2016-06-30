// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Returns a string representing serialized descriptors, which is a suitable
// srcset attribute value for an element
// TODO: THIS IS INCOMPLETE
// TODO: support d,w,h, 'x'?
// TODO: i am also seeing something like url 2x or 1.5x, what's "x"? i assume
// it is something like zoom level (2x is 2 times size)
function serializeSrcset(inputSrcset) {
  const newSrcset = [];

  for(let i = 0, len = inputSrcset.length; i < len; i++) {
    let descriptor = inputSrcset[i];
    console.debug('Descriptor:', descriptor);
    let newString = descriptor.url;

    if(descriptor.d) {
      // newString += ' ' + descriptor.d;
    }

    if(descriptor.w) {
      // newString += ' ' + descriptor.w + 'w';
    }

    if(descriptor.h) {
      // newString += ' ' + descriptor.h + 'h';
    }

    newSrcset.push(newString);
  }

  // NOTE: the space following the comma is important
  return newSrcset.join(', ');
}
