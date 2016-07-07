// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Returns a string representing serialized descriptors, which is a suitable
// srcset attribute value for an element
// TODO: This is under development. Untested.
function serializeSrcset(inputSrcset) {
  // Will contain an array of descriptor strings
  const newSrcset = [];

  for(let i = 0, len = inputSrcset.length; i < len; i++) {
    let descriptor = inputSrcset[i];

    // String builder
    let builder = [];

    builder.push(descriptor.url);

    // d is density
    if(descriptor.d) {
      builder.push(' ');
      builder.push(descriptor.d);
      // d can have the x?
    }

    // w is width
    if(descriptor.w) {
      builder.push(' ');
      builder.push(descriptor.w);
      builder.push('w');
    }

    // h is future-compat-h
    if(descriptor.h) {
      builder.push(' ');
      builder.push(descriptor.h);
      builder.push('h');
    }

    newSrcset.push(builder.join(''));
  }

  // NOTE: the space following the comma is important
  return newSrcset.join(', ');
}
