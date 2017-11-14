// Functions for working with the srcset attribute of a DOM element

import assert from "/src/assert.js";
// This script defines parseSrcset in global scope
import "/src/third-party/parse-srcset.js";

// @param descriptors {Array} an array of descriptors such as those produced
// by parseSrcset (third party library)
// @returns {String} a string suitable for storing as srcset attribute value
export function serializeSrcset(descriptors) {
  assert(Array.isArray(descriptors));

  const descriptorStrings = [];
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

    const descriptorString = strings.join('');
    descriptorStrings.push(descriptorString);
  }

  return descriptorStrings.join(', ');
}

// TODO: figure out how to import the third-party library and just export a function named
// parseSrcset. The library doesn't export anything, so look into ways to still get its contents.
// Take another look at import * as foo.

// Returns an array of descriptor objects. If the input is bad, or an error occurs, returns an
// empty array.
// @param srcset {String}
export function parseSrcsetWrapper(srcset) {
  const fallbackOutput = [];

  // This wraps a call to a third-party library so it is overly defensive.

  if(typeof srcset !== 'string') {
    return fallbackOutput;
  }

  let descriptors;
  try {
    descriptors = parseSrcset(srcset);
  } catch(error) {
    return fallbackOutput;
  }

  if(!Array.isArray(descriptors)) {
    return fallbackOutput;
  }

  return descriptors;
}
