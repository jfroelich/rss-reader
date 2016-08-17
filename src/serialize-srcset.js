// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// @param descriptors {Array} an array of basic descriptor objects such as the
// one produced by the parseSrcset library
function serialize_srcset(descriptors) {
  const outputStringBuffer = [];
  for(let descriptor of descriptors) {
    let sb = [descriptor.url];
    if(descriptor.d) {
      sb.push(' ');
      sb.push(descriptor.d);
      sb.push('x');
    } else if(descriptor.w) {
      sb.push(' ');
      sb.push(descriptor.w);
      sb.push('w');
    } else if(descriptor.h) {
      sb.push(' ');
      sb.push(descriptor.h);
      sb.push('h');
    }

    outputStringBuffer.push(sb.join(''));
  }

  // The space is important
  return outputStringBuffer.join(', ');
}
