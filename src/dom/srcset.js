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

// TODO: wrap this around the 3rd party library, make this the sole interface
// to that library. Then code to the contract of this function, regardless
// of the behavior of that other library. That way the code is invariant
// This should be the only module that loads the third party module
// TODO: use try/catch and such to avoid any issues with 3rd party lib. Also
// provide a warranty as to whether the return value is defined
function srcset_parse_from_string(srcset_string) {
  throw new Error('Not implemented');
}
