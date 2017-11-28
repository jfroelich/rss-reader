import assert from "/src/assert/assert.js";
// This defines parseSrcset in global scope
import "/src/third-party/parse-srcset.js";

// @param descriptors {Array} an array of descriptors such as those produced by parseSrcset
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

// Returns an array of descriptor objects. If the input is bad, or an error occurs, returns an
// empty array. This wraps a call to a third-party library so it is overly defensive.
// @param srcset {String}
export function parseSrcsetWrapper(srcset) {
  const fallbackOutput = [];

  // Try and avoid the call in case of unexpected input. Not an assertion error for convenience
  if(typeof srcset !== 'string') {
    return fallbackOutput;
  }

  // Try and avoid the call in case of empty string
  if(!srcset) {
    return fallbackOutput;
  }

  let descriptors;
  try {
    descriptors = parseSrcset(srcset);
  } catch(error) {
    console.warn('Error parsing srcset ignored: ' + srcset);
    return fallbackOutput;
  }

  if(!Array.isArray(descriptors)) {
    return fallbackOutput;
  }

  return descriptors;
}
