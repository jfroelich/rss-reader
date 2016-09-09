// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// @param descriptors {Array} an array of basic descriptor objects such as the
// one produced by the parseSrcset library
function serializeSrcset(descriptors) {
  console.assert(descriptors);

  const outputBuffer = [];
  for(let descriptor of descriptors) {
    let descBuffer = [descriptor.url];
    if(descriptor.d) {
      descBuffer.push(' ');
      descBuffer.push(descriptor.d);
      descBuffer.push('x');
    } else if(descriptor.w) {
      descBuffer.push(' ');
      descBuffer.push(descriptor.w);
      descBuffer.push('w');
    } else if(descriptor.h) {
      descBuffer.push(' ');
      descBuffer.push(descriptor.h);
      descBuffer.push('h');
    }

    outputBuffer.push(descBuffer.join(''));
  }

  // The space is important
  return outputBuffer.join(', ');
}
