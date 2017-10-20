'use strict';

// import base/assert.js
// import third-party/parseSrcset.js

// @param descriptors {Array} an array of descriptors such as those produced
// by parseSrcset (third party library)
// @returns {String} a string suitable for storing as srcset attribute value
function srcset_serialize(descriptors) {
  ASSERT(Array.isArray(descriptors));

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

// Returns an array of descriptor objects
// Does not throw. Any errors result in an empty array returned instead.
function srcset_parse_from_string(srcset_string) {
  const fallback_output = [];

  if(typeof srcset_string !== 'string') {
    return fallback_output;
  }

  let descriptors;
  try {
    descriptors = parseSrcset(srcset_string);
  } catch(error) {
    return fallback_output;
  }

  if(!Array.isArray(descriptors)) {
    return fallback_output;
  }

  return descriptors;
}
