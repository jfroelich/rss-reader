// srcset utilities
'use strict';

// Dependencies
// parseSrcset.js


// @param descriptors {Array} an array of descriptors such as those produced
// by parseSrcset (third party library)
// @returns {String} a string suitable for storing as srcset attribute value
function srcset_serialize(descriptors) {
  const descriptor_strings = [];
  for(const descriptor of descriptors) {
    const strings = [descriptor.url];
    if(descriptor.d) {
      strings.push(' ');
      strings.push(descriptor.d);
      strings.push('x');
    } else if(descriptor.w) {
      strings.push(' ');
      strings.push(descriptor.w);
      strings.push('w');
    } else if(descriptor.h) {
      strings.push(' ');
      strings.push(descriptor.h);
      strings.push('h');
    }

    const descriptor_string = strings.join('');
    descriptor_strings.push(descriptor_string);
  }

  return descriptor_strings.join(', ');
}

function srcset_parse_from_string(srcset_string) {
  throw new Error('Not implemented');
}
