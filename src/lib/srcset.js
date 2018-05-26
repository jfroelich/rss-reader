import '/third-party/parse-srcset.js';

/*

# srcset
Provides utilities for working with html srcset attributes. The `parse` function
parses a srcset value into an array of descriptors. If the input is bad, or an
error occurs, or no descriptors found, returns an empty array. This function
makes use of third-party code. The srcset param may be any value, but should
generally be a string containing the value of the srcset attribute of an html
element.


*/

export function serialize(descriptors) {
  if (!Array.isArray(descriptors)) {
    throw new TypeError('descriptors is not an array');
  }

  const descriptor_strings = [];
  for (const descriptor of descriptors) {
    const strings = [descriptor.url];
    if (descriptor.d) {
      strings.push(' ');
      strings.push(descriptor.d);
      strings.push('x');
    } else if (descriptor.w) {
      strings.push(' ');
      strings.push(descriptor.w);
      strings.push('w');
    } else if (descriptor.h) {
      strings.push(' ');
      strings.push(descriptor.h);
      strings.push('h');
    }

    const descriptor_string = strings.join('');
    descriptor_strings.push(descriptor_string);
  }

  return descriptor_strings.join(', ');
}

export function parse(srcset) {
  return (srcset && typeof srcset === 'string') ? parseSrcset(srcset) : [];
}
