// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// @param descriptors {Array} an array of basic descriptor objects such as the
// one produced by the parseSrcset library
function serialize_srcset(descriptors) {
  console.assert(descriptors);

  const output_buffer = [];
  for(let descriptor of descriptors) {
    let desc_buffer = [descriptor.url];
    if(descriptor.d) {
      desc_buffer.push(' ');
      desc_buffer.push(descriptor.d);
      desc_buffer.push('x');
    } else if(descriptor.w) {
      desc_buffer.push(' ');
      desc_buffer.push(descriptor.w);
      desc_buffer.push('w');
    } else if(descriptor.h) {
      desc_buffer.push(' ');
      desc_buffer.push(descriptor.h);
      desc_buffer.push('h');
    }

    output_buffer.push(desc_buffer.join(''));
  }

  // The space is important
  return output_buffer.join(', ');
}
